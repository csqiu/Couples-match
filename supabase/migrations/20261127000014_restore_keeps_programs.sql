-- Restoring a version keeps today's programs (bug log #35).
--
-- Before, restoring put back the version's program lists exactly, so programs added
-- since disappeared. Now it works like opening a list: each partner keeps the programs
-- they have, with tiers, order and "acceptable" from the version; programs the version
-- didn't have go to Tier B at the end. Pairs involving those newer programs are held
-- off the final list (the list setting heldPrograms: [partner A's ids, partner B's ids])
-- until the couple brings them in, so the restored list matches the saved one.
--
-- It is also quiet now (bug log #36): one "restored" entry in Activity instead of one
-- per table, and answers and moves keep their dates and authors where today's rows
-- still have them (a snapshot only stores who answered, not when or who dragged).

-- heldPrograms belongs to a list, like the other list settings.
create or replace function public.list_setting_keys()
returns text[]
language sql immutable set search_path = ''
as $$
  select array['listLength', 'includedPairs', 'noMatchUnlocked', 'listOrder', 'deferredQuestions', 'flaggedQuestions', 'heldPrograms'];
$$;

create or replace function public.restore_version(p_version uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v public.list_versions%rowtype;
  c public.couples%rowtype;
  snap jsonb;
  cur jsonb;
  st jsonb;
  held jsonb;
begin
  select * into v from public.list_versions where id = p_version;
  if not found or not public.is_active_member(v.couple_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into c from public.couples where id = v.couple_id for update;
  if c.active_list is distinct from v.list_id then
    raise exception 'version_in_other_list' using errcode = 'P0001';
  end if;
  snap := v.inputs_snapshot;
  cur := public.capture_list_state(c.id);

  -- Programs each partner has now that the version didn't have.
  held := jsonb_build_array(
    coalesce((
      select jsonb_agg(r->>'programId' order by (r->>'rank')::int)
      from jsonb_array_elements(coalesce(cur->'ranks', '[]'::jsonb)) r
      where (r->>'userId')::uuid = c.partner_a
        and not exists (select 1 from jsonb_array_elements(coalesce(snap->'lists'->0, '[]'::jsonb)) e where e->>'programId' = r->>'programId')
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(r->>'programId' order by (r->>'rank')::int)
      from jsonb_array_elements(coalesce(cur->'ranks', '[]'::jsonb)) r
      where (r->>'userId')::uuid = c.partner_b
        and not exists (select 1 from jsonb_array_elements(coalesce(snap->'lists'->1, '[]'::jsonb)) e where e->>'programId' = r->>'programId')
    ), '[]'::jsonb));

  -- The version in the shape load_list_state reads (capture_list_state's).
  -- lists[0] is partner A's, lists[1] partner B's.
  st := jsonb_build_object(
    'ranks', coalesce((
      select jsonb_agg(e || jsonb_build_object('userId', case side when 0 then c.partner_a else c.partner_b end))
      from generate_series(0, 1) side,
           jsonb_array_elements(coalesce(snap->'lists'->side, '[]'::jsonb)) e
      where (case side when 0 then c.partner_a else c.partner_b end) is not null), '[]'::jsonb),
    -- Already in answer order (seq). An answer still here today keeps its date.
    'comparisons', coalesce((
      select jsonb_agg(e || coalesce((
          select jsonb_build_object('createdAt', x->'createdAt')
          from jsonb_array_elements(coalesce(cur->'comparisons', '[]'::jsonb)) x
          where x->>'id' = e->>'id' limit 1), '{}'::jsonb) order by i)
      from jsonb_array_elements(coalesce(snap->'comparisons', '[]'::jsonb)) with ordinality as t(e, i)), '[]'::jsonb),
    -- In the order they were made (drags are replayed in that order). A move still here
    -- today keeps its author; otherwise it's credited to whoever restores.
    'pins', coalesce((
      select jsonb_agg(e || jsonb_build_object('createdBy', coalesce((
          select x->'createdBy'
          from jsonb_array_elements(coalesce(cur->'pins', '[]'::jsonb)) x
          where x->>'higher' = e->>'higher' and x->>'lower' = e->>'lower' and x->>'source' = e->>'source'
            and x->'createdBy' <> 'null'::jsonb
          limit 1), to_jsonb((select auth.uid())))) order by i)
      from jsonb_array_elements(coalesce(snap->'pins', '[]'::jsonb)) with ordinality as t(e, i)), '[]'::jsonb),
    'exclusions', coalesce((
      select jsonb_agg(e || jsonb_build_object('createdBy', (select auth.uid())))
      from jsonb_array_elements(coalesce(snap->'exclusions', '[]'::jsonb)) e), '[]'::jsonb),
    'exceptions', coalesce((
      select jsonb_agg(e || jsonb_build_object('createdBy', (select auth.uid())))
      from jsonb_array_elements(coalesce(snap->'exceptions', '[]'::jsonb)) e), '[]'::jsonb),
    -- Engine settings and list settings come back from the version; app-only couple
    -- settings (privacy, answer mode) stay as they are, and so do the list settings a
    -- version doesn't keep (questions saved for later or flagged, the display order).
    'settings', (
      select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
      from jsonb_each(coalesce(cur->'settings', '{}'::jsonb)) s
      where s.key in ('deferredQuestions', 'flaggedQuestions', 'listOrder'))
      || (coalesce(snap->'settings', '{}'::jsonb) - 'matchType' - 'heldPrograms')
      || case when held = '[[], []]'::jsonb then '{}'::jsonb else jsonb_build_object('heldPrograms', held) end
  );

  perform set_config('pairwise.quiet', 'on', true);
  perform public.load_list_state(c.id, cur, st);
  perform set_config('pairwise.quiet', 'off', true);

  insert into public.audit_events (couple_id, user_id, type, payload)
  values (c.id, public.acting_user(), 'list_versions.restored', jsonb_build_object('version', v.id, 'name', v.name));
end;
$$;

revoke all on function public.restore_version(uuid), public.list_setting_keys() from public, anon, authenticated;
grant execute on function public.restore_version(uuid) to authenticated;
