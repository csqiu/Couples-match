-- Bug log #1: a person's program list belongs to them, not to the couple.
--
-- Rank rows still live with a couple (the engine and row level security work per
-- couple), but a list now outlives the couple it was made in:
--  * when a couple ends, each partner's list is saved to them (saved_rank_lists);
--  * when they start or join their next couple in the same match, it comes back;
--  * restore_saved_rank_list() brings it back by hand (for lists saved before this).
-- Programs a couple added themselves (created_by_couple) end with that couple, so
-- they're left out; everything else keeps its rank, tier, note and NRMP code.

create table public.saved_rank_lists (
  user_id uuid primary key references auth.users (id) on delete cascade,
  match_type public.match_type not null,
  -- [{programId, rank, tier, acceptable, note, nrmpCode}], best first.
  entries jsonb not null check (jsonb_typeof(entries) = 'array'),
  from_couple uuid,
  saved_at timestamptz not null default now()
);

alter table public.saved_rank_lists enable row level security;
create policy "read own saved list" on public.saved_rank_lists for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.saved_rank_lists to authenticated;

-- Saves one member's list from a couple (no-op when they have none).
create or replace function public.save_rank_list(p_couple uuid, p_user uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  list jsonb;
  mt public.match_type;
begin
  select c.match_type into mt from public.couples c where c.id = p_couple;
  select jsonb_agg(jsonb_build_object(
           'programId', r.program_id, 'rank', r.rank, 'tier', r.tier, 'acceptable', r.acceptable,
           'note', r.note, 'nrmpCode', r.nrmp_code) order by r.rank)
    into list
    from public.individual_ranks r
    join public.programs p on p.id = r.program_id
    where r.couple_id = p_couple and r.user_id = p_user and p.created_by_couple is null;
  if list is null or mt is null then
    return;
  end if;
  insert into public.saved_rank_lists as s (user_id, match_type, entries, from_couple, saved_at)
  values (p_user, mt, list, p_couple, now())
  on conflict (user_id) do update
    set match_type = excluded.match_type, entries = excluded.entries,
        from_couple = excluded.from_couple, saved_at = excluded.saved_at;
end;
$$;

-- Puts a member's saved list into a couple, if they have nothing there yet and it's
-- the same match. Returns how many programs came back.
create or replace function public.load_saved_rank_list(p_couple uuid, p_user uuid)
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  cpl public.couples%rowtype;
  saved public.saved_rank_lists%rowtype;
  n int;
begin
  select * into cpl from public.couples where id = p_couple;
  if not found or cpl.status = 'dissolved' or p_user is null or p_user not in (cpl.partner_a, cpl.partner_b) then
    return 0;
  end if;
  if exists (select 1 from public.individual_ranks where couple_id = p_couple and user_id = p_user) then
    return 0;
  end if;
  select * into saved from public.saved_rank_lists where user_id = p_user;
  if not found or saved.match_type <> cpl.match_type then
    return 0;
  end if;
  insert into public.individual_ranks (couple_id, user_id, program_id, rank, tier, acceptable, note, nrmp_code)
  select p_couple, p_user, e.program_id, row_number() over (order by e.rank), e.tier, e.acceptable, e.note, e.nrmp_code
  from (
    select x->>'programId' as program_id, (x->>'rank')::int as rank, (x->>'tier')::public.tier as tier,
           coalesce((x->>'acceptable')::boolean, true) as acceptable, x->>'note' as note, nullif(x->>'nrmpCode', '') as nrmp_code
    from jsonb_array_elements(saved.entries) x
  ) e
  join public.programs p on p.id = e.program_id
  where p.created_by_couple is null and p.match_type = cpl.match_type
  order by e.rank
  limit 300;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- When a couple ends, both partners keep their lists.
create or replace function public.save_lists_on_dissolve()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.partner_a is not null then perform public.save_rank_list(new.id, new.partner_a); end if;
  if new.partner_b is not null then perform public.save_rank_list(new.id, new.partner_b); end if;
  return null;
end;
$$;
create trigger couples_save_lists
  after update of status on public.couples
  for each row when (new.status = 'dissolved' and old.status is distinct from 'dissolved')
  execute function public.save_lists_on_dissolve();

-- Starting or joining a couple brings your saved list along.
create or replace function public.load_lists_on_join()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'dissolved' then
    return null;
  end if;
  if tg_op = 'INSERT' then
    perform public.load_saved_rank_list(new.id, new.partner_a);
    perform public.load_saved_rank_list(new.id, new.partner_b);
  elsif old.partner_b is null and new.partner_b is not null then
    perform public.load_saved_rank_list(new.id, new.partner_b);
  end if;
  return null;
end;
$$;
create trigger couples_load_lists
  after insert or update of partner_b on public.couples
  for each row execute function public.load_lists_on_join();

-- "Bring back my list" in the app: for lists saved before this migration, or after
-- clearing a list by mistake. Only into your own, empty, list.
create or replace function public.restore_saved_rank_list(p_couple uuid)
returns int
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_active_member(p_couple) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return public.load_saved_rank_list(p_couple, (select auth.uid()));
end;
$$;

revoke all on function public.save_rank_list(uuid, uuid), public.load_saved_rank_list(uuid, uuid),
  public.save_lists_on_dissolve(), public.load_lists_on_join(), public.restore_saved_rank_list(uuid)
  from public, anon, authenticated;
grant execute on function public.restore_saved_rank_list(uuid) to authenticated;

-- Lists in couples that already ended (still kept for 30 days): save the newest one per person.
do $$
declare
  r record;
begin
  for r in
    select distinct on (m.user_id) m.user_id, c.id as couple_id
    from public.couples c
    cross join lateral (values (c.partner_a), (c.partner_b)) as m(user_id)
    where c.status = 'dissolved' and m.user_id is not null
      and exists (select 1 from public.individual_ranks ir where ir.couple_id = c.id and ir.user_id = m.user_id)
    order by m.user_id, c.dissolved_at desc
  loop
    perform public.save_rank_list(r.couple_id, r.user_id);
  end loop;
end;
$$;
