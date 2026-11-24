-- Phase 8: admin review of programs, merging duplicates, and admin imports.

-- ---------------------------------------------------------------------------
-- Admin import: insert or update global programs by id (the import pipeline's
-- deterministic ids), in one call. A function rather than a column grant, so
-- couples still can't choose a program's id.

create or replace function public.import_programs(p_programs jsonb)
returns table (inserted int, updated int)
language plpgsql security definer set search_path = ''
as $$
declare
  ins int;
  upd int;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if jsonb_typeof(p_programs) <> 'array' or jsonb_array_length(p_programs) > 5000 then
    raise exception 'bad_input' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_programs) e
    left join public.programs p on p.id = e->>'id'
    where e->>'id' is null or e->>'id' like 'user-%' or e->>'id' like 'NO_MATCH%' or p.created_by_couple is not null
  ) then
    raise exception 'bad_input' using errcode = '22023';
  end if;

  with written as (
    insert into public.programs as p (id, name, institution, specialty_code, specialty_name, match_type, match_name, acgme_id,
                                      city, state, address, lat, lon, geocode_confidence, geocode_source, is_advanced, source, verified)
    select id, name, institution, "specialtyCode", "specialtyName", "matchType"::public.match_type, "matchName", "acgmeId",
           coalesce(city, ''), coalesce(state, ''), coalesce(address, ''), lat, lon, "geocodeConfidence", "geocodeSource",
           coalesce("isAdvanced", false), source, coalesce(verified, false)
    from jsonb_to_recordset(p_programs) as x(
      id text, name text, institution text, "specialtyCode" text, "specialtyName" text, "matchType" text, "matchName" text,
      "acgmeId" text, city text, state text, address text, lat double precision, lon double precision,
      "geocodeConfidence" real, "geocodeSource" text, "isAdvanced" boolean, source text, verified boolean)
    on conflict (id) do update set
      name = excluded.name, institution = excluded.institution, specialty_code = excluded.specialty_code,
      specialty_name = excluded.specialty_name, match_type = excluded.match_type, match_name = excluded.match_name,
      acgme_id = excluded.acgme_id, city = excluded.city, state = excluded.state, address = excluded.address,
      is_advanced = excluded.is_advanced, source = excluded.source,
      -- A location an admin fixed by hand is never overwritten by a re-import.
      lat = case when p.geocode_source = 'manual' then p.lat else excluded.lat end,
      lon = case when p.geocode_source = 'manual' then p.lon else excluded.lon end,
      geocode_confidence = case when p.geocode_source = 'manual' then p.geocode_confidence else excluded.geocode_confidence end,
      geocode_source = case when p.geocode_source = 'manual' then p.geocode_source else excluded.geocode_source end,
      verified = p.verified or excluded.verified
    returning (xmax = 0) as is_new
  )
  select count(*) filter (where is_new), count(*) filter (where not is_new) into ins, upd from written;

  return query select ins, upd;
end;
$$;

-- ---------------------------------------------------------------------------
-- Possible duplicates: same specialty, within a mile, at least one side unverified.

create or replace function public.program_duplicates()
returns table (program_a text, program_b text, distance_mi double precision)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
  select a.id, b.id, extensions.st_distance(a.geom, b.geom) / 1609.344
  from public.programs a
  join public.programs b
    on b.specialty_code = a.specialty_code
   and b.id > a.id
   and extensions.st_dwithin(a.geom, b.geom, 1609.344)
  where (not a.verified or not b.verified)
    and a.id not like 'NO_MATCH%' and b.id not like 'NO_MATCH%'
  order by 3, 1, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- Merge a duplicate (p_from) into the program it duplicates (p_to).
--
-- Every couple that used p_from now uses p_to: rank rows move across (if a partner
-- had both, the higher-ranked row is kept), and every pair id in comparisons,
-- pins, exclusions and rule exceptions is rewritten. Rows that the rewrite turns
-- into nonsense (a pair compared with itself, a duplicate exception) are dropped.
-- Saved versions are frozen snapshots and are left as they were.

-- Replaces one side of a pair id.
create or replace function public.swap_pair_side(p text, p_from text, p_to text)
returns text
language sql immutable set search_path = ''
as $$
  select case when split_part(p, '|', 1) = p_from then p_to else split_part(p, '|', 1) end
      || '|' ||
         case when split_part(p, '|', 2) = p_from then p_to else split_part(p, '|', 2) end;
$$;

create or replace function public.merge_programs(p_from text, p_to text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  src record;
  dst record;
begin
  if not public.is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_from = p_to then
    raise exception 'same_program' using errcode = 'P0001';
  end if;
  select * into src from public.programs where id = p_from for update;
  select * into dst from public.programs where id = p_to for update;
  if src.id is null or dst.id is null or p_from like 'NO_MATCH%' or p_to like 'NO_MATCH%' then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;
  if src.match_type <> dst.match_type then
    raise exception 'program_wrong_match' using errcode = 'P0001';
  end if;
  -- A couple's private program can only absorb that same couple's programs.
  if dst.created_by_couple is not null and dst.created_by_couple is distinct from src.created_by_couple then
    raise exception 'program_not_available' using errcode = 'P0001';
  end if;

  -- Ranks. Where a partner listed both, keep the better-ranked row (as p_to),
  -- carrying over a typed NRMP code and note if the kept row lacks them.
  with both_rows as (
    select f.couple_id, f.user_id, f.rank as from_rank, t.rank as to_rank,
           f.nrmp_code as from_code, f.note as from_note, f.tier as from_tier, f.acceptable as from_ok
    from public.individual_ranks f
    join public.individual_ranks t
      on t.couple_id = f.couple_id and t.user_id = f.user_id and t.program_id = p_to
    where f.program_id = p_from
  )
  update public.individual_ranks r
  set rank = least(b.from_rank, b.to_rank),
      tier = case when b.from_rank < b.to_rank then b.from_tier else r.tier end,
      acceptable = case when b.from_rank < b.to_rank then b.from_ok else r.acceptable end,
      nrmp_code = coalesce(r.nrmp_code, b.from_code),
      note = coalesce(r.note, b.from_note)
  from both_rows b
  where r.couple_id = b.couple_id and r.user_id = b.user_id and r.program_id = p_to
    and (b.from_rank < b.to_rank or r.nrmp_code is null or r.note is null);

  delete from public.individual_ranks f
  where f.program_id = p_from
    and exists (select 1 from public.individual_ranks t
                where t.couple_id = f.couple_id and t.user_id = f.user_id and t.program_id = p_to);

  update public.individual_ranks set program_id = p_to where program_id = p_from;

  -- Close the gaps left by dropped rows (the rank constraint is deferred).
  update public.individual_ranks r
  set rank = n.new_rank
  from (
    select couple_id, user_id, program_id, row_number() over (partition by couple_id, user_id order by rank) as new_rank
    from public.individual_ranks
    where (couple_id, user_id) in (select couple_id, user_id from public.individual_ranks where program_id = p_to)
  ) n
  where r.couple_id = n.couple_id and r.user_id = n.user_id and r.program_id = n.program_id and r.rank <> n.new_rank;

  -- Comparisons (pins made from them cascade).
  delete from public.comparisons c
  where (c.pair_left like '%' || p_from || '%' or c.pair_right like '%' || p_from || '%')
    and public.swap_pair_side(c.pair_left, p_from, p_to) = public.swap_pair_side(c.pair_right, p_from, p_to);
  update public.comparisons
  set pair_left = public.swap_pair_side(pair_left, p_from, p_to),
      pair_right = public.swap_pair_side(pair_right, p_from, p_to)
  where pair_left <> public.swap_pair_side(pair_left, p_from, p_to)
     or pair_right <> public.swap_pair_side(pair_right, p_from, p_to);

  -- Pins.
  delete from public.pins p
  where public.swap_pair_side(p.higher_pair, p_from, p_to) = public.swap_pair_side(p.lower_pair, p_from, p_to);
  update public.pins
  set higher_pair = public.swap_pair_side(higher_pair, p_from, p_to),
      lower_pair = public.swap_pair_side(lower_pair, p_from, p_to)
  where higher_pair <> public.swap_pair_side(higher_pair, p_from, p_to)
     or lower_pair <> public.swap_pair_side(lower_pair, p_from, p_to);

  -- Rule exceptions (unique per couple).
  delete from public.rule_exceptions e
  where public.swap_pair_side(e.higher_pair, p_from, p_to) = public.swap_pair_side(e.lower_pair, p_from, p_to)
     or ((e.higher_pair <> public.swap_pair_side(e.higher_pair, p_from, p_to)
          or e.lower_pair <> public.swap_pair_side(e.lower_pair, p_from, p_to))
         and exists (select 1 from public.rule_exceptions o
                     where o.couple_id = e.couple_id and o.id <> e.id
                       and o.higher_pair = public.swap_pair_side(e.higher_pair, p_from, p_to)
                       and o.lower_pair = public.swap_pair_side(e.lower_pair, p_from, p_to)));
  update public.rule_exceptions
  set higher_pair = public.swap_pair_side(higher_pair, p_from, p_to),
      lower_pair = public.swap_pair_side(lower_pair, p_from, p_to)
  where higher_pair <> public.swap_pair_side(higher_pair, p_from, p_to)
     or lower_pair <> public.swap_pair_side(lower_pair, p_from, p_to);

  -- Exclusions (unique per couple).
  delete from public.pair_exclusions x
  where (x.program_a = p_from or x.program_b = p_from)
    and exists (select 1 from public.pair_exclusions o
                where o.couple_id = x.couple_id and o.id <> x.id
                  and o.program_a = case when x.program_a = p_from then p_to else x.program_a end
                  and o.program_b = case when x.program_b = p_from then p_to else x.program_b end);
  update public.pair_exclusions
  set program_a = case when program_a = p_from then p_to else program_a end,
      program_b = case when program_b = p_from then p_to else program_b end
  where program_a = p_from or program_b = p_from;

  delete from public.programs where id = p_from;
end;
$$;

revoke all on function public.program_duplicates(), public.merge_programs(text, text), public.swap_pair_side(text, text, text),
  public.import_programs(jsonb)
  from public, anon, authenticated;
grant execute on function public.program_duplicates(), public.merge_programs(text, text), public.import_programs(jsonb)
  to authenticated;
