-- Each person's own short name for a program on their list ("MGH IM", "Hopkins Peds").
-- It lives on their rank row, so it changes only how their list reads (for both
-- partners), never the shared program catalog. Null = the automatic short name.
alter table public.individual_ranks
  add column short_name text check (short_name is null or char_length(btrim(short_name)) between 1 and 40);

-- Saved lists (a couple ending, then a new couple) keep the short names too.
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
           'note', r.note, 'nrmpCode', r.nrmp_code, 'shortName', r.short_name) order by r.rank)
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
  insert into public.individual_ranks (couple_id, user_id, program_id, rank, tier, acceptable, note, nrmp_code, short_name)
  select p_couple, p_user, e.program_id, row_number() over (order by e.rank), e.tier, e.acceptable, e.note, e.nrmp_code, e.short_name
  from (
    select x->>'programId' as program_id, (x->>'rank')::int as rank, (x->>'tier')::public.tier as tier,
           coalesce((x->>'acceptable')::boolean, true) as acceptable, x->>'note' as note, nullif(x->>'nrmpCode', '') as nrmp_code,
           nullif(btrim(x->>'shortName'), '') as short_name
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

revoke all on function public.save_rank_list(uuid, uuid), public.load_saved_rank_list(uuid, uuid)
  from public, anon, authenticated;
