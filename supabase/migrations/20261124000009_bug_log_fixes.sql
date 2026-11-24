-- Bug-log fixes (#14, #16 and drag placement):
--  * pins.moved_pair — which pair a manual drag moved ('higher' = dragged up, 'lower' =
--    dragged down), so the engine can put it exactly where it was dropped. Older pins
--    leave it null and only constrain the order, as before.
--  * programs.short_name — an optional abbreviation ("Hopkins Plastics", "MGB Ortho").
--    The app derives one from the name when this is null (packages/data/src/short-name.ts).
--  * restore_version — restores moved_pair and the order pins were made in.

alter table public.pins add column moved_pair text check (moved_pair in ('higher', 'lower'));
create index if not exists pins_couple_created_idx on public.pins (couple_id, created_at);

alter table public.programs add column short_name text check (char_length(short_name) between 1 and 60);

create or replace function public.restore_version(p_version uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v public.list_versions%rowtype;
  c public.couples%rowtype;
  snap jsonb;
  side int;
  owner uuid;
begin
  select * into v from public.list_versions where id = p_version;
  if not found or not public.is_active_member(v.couple_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into c from public.couples where id = v.couple_id for update;
  snap := v.inputs_snapshot;

  delete from public.comparisons where couple_id = c.id; -- their pins go with them
  delete from public.pins where couple_id = c.id;
  delete from public.pair_exclusions where couple_id = c.id;
  delete from public.rule_exceptions where couple_id = c.id;
  delete from public.individual_ranks where couple_id = c.id;

  -- Rank lists: lists[0] is partner A's, lists[1] partner B's. Programs that no
  -- longer exist (or aren't available to this couple) are skipped.
  for side in 0..1 loop
    owner := case side when 0 then c.partner_a else c.partner_b end;
    continue when owner is null;
    insert into public.individual_ranks (couple_id, user_id, program_id, rank, tier, acceptable, note, nrmp_code)
    select c.id, owner, e->>'programId', (e->>'rank')::int, (e->>'tier')::public.tier,
           coalesce((e->>'acceptable')::boolean, true), e->>'note', nullif(e->>'nrmpCode', '')
    from jsonb_array_elements(coalesce(snap->'lists'->side, '[]'::jsonb)) e
    join public.programs p on p.id = e->>'programId'
    where p.created_by_couple is null or p.created_by_couple = c.id;
  end loop;

  insert into public.comparisons (id, couple_id, pair_left, pair_right, winner, answered_by, both_agreed, locked)
  select (e->>'id')::uuid, c.id, e->>'left', e->>'right', (e->>'winner')::public.comparison_winner,
         (select u.id from auth.users u where u.id = (e->>'answeredBy')::uuid),
         coalesce((e->>'bothAgreed')::boolean, false), coalesce((e->>'locked')::boolean, false)
  from jsonb_array_elements(coalesce(snap->'comparisons', '[]'::jsonb)) e
  where (e->>'id') ~ '^[0-9a-f-]{36}$'
  order by (e->>'seq')::bigint nulls last;

  -- Pins keep their order (drags are replayed in the order they were made).
  insert into public.pins (couple_id, higher_pair, lower_pair, source, comparison_id, created_by, moved_pair, created_at)
  select c.id, e->>'higher', e->>'lower', (e->>'source')::public.pin_source,
         (select x.id from public.comparisons x where x.id::text = e->>'comparisonId'), (select auth.uid()),
         case when e->>'moved' in ('higher', 'lower') then e->>'moved' end,
         now() + (i * interval '1 microsecond')
  from jsonb_array_elements(coalesce(snap->'pins', '[]'::jsonb)) with ordinality as t(e, i);

  insert into public.pair_exclusions (couple_id, program_a, program_b, reason, created_by)
  select c.id, e->>'programA', e->>'programB', e->>'reason', (select auth.uid())
  from jsonb_array_elements(coalesce(snap->'exclusions', '[]'::jsonb)) e
  on conflict do nothing;

  insert into public.rule_exceptions (couple_id, higher_pair, lower_pair, created_by)
  select c.id, e->>'higher', e->>'lower', (select auth.uid())
  from jsonb_array_elements(coalesce(snap->'exceptions', '[]'::jsonb)) e
  on conflict do nothing;

  -- Engine settings come back from the version; app-only settings (privacy) stay as they are.
  update public.couples
    set settings = settings || ((coalesce(snap->'settings', '{}'::jsonb)) - 'matchType')
    where id = c.id;

  insert into public.audit_events (couple_id, user_id, type, payload)
  values (c.id, public.acting_user(), 'list_versions.restored', jsonb_build_object('version', v.id, 'name', v.name));
end;
$$;

revoke all on function public.restore_version(uuid) from public, anon, authenticated;
grant execute on function public.restore_version(uuid) to authenticated;
