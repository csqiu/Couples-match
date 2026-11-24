-- The NRMP Main Match directory import: programs now carry their official NRMP code.
-- Same function as migration 7, plus the "nrmpCode" field.

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
    insert into public.programs as p (id, name, institution, specialty_code, specialty_name, match_type, match_name, acgme_id, nrmp_code,
                                      city, state, address, lat, lon, geocode_confidence, geocode_source, is_advanced, source, verified)
    select id, name, institution, "specialtyCode", "specialtyName", "matchType"::public.match_type, "matchName", "acgmeId", "nrmpCode",
           coalesce(city, ''), coalesce(state, ''), coalesce(address, ''), lat, lon, "geocodeConfidence", "geocodeSource",
           coalesce("isAdvanced", false), source, coalesce(verified, false)
    from jsonb_to_recordset(p_programs) as x(
      id text, name text, institution text, "specialtyCode" text, "specialtyName" text, "matchType" text, "matchName" text,
      "acgmeId" text, "nrmpCode" text, city text, state text, address text, lat double precision, lon double precision,
      "geocodeConfidence" real, "geocodeSource" text, "isAdvanced" boolean, source text, verified boolean)
    on conflict (id) do update set
      name = excluded.name, institution = excluded.institution, specialty_code = excluded.specialty_code,
      specialty_name = excluded.specialty_name, match_type = excluded.match_type, match_name = excluded.match_name,
      acgme_id = excluded.acgme_id, nrmp_code = excluded.nrmp_code, city = excluded.city, state = excluded.state, address = excluded.address,
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

-- Re-creating a function keeps its grants, but restate them so this file stands alone.
revoke all on function public.import_programs(jsonb) from public, anon;
grant execute on function public.import_programs(jsonb) to authenticated;

-- Search by NRMP code ("1261140C0") as well as name and city.
create index if not exists programs_nrmp_code_idx on public.programs (nrmp_code) where nrmp_code is not null;

-- A program's 11th track onwards has a 10-character code (e.g. 2978140C10).
alter table public.individual_ranks drop constraint if exists individual_ranks_nrmp_code_check;
alter table public.individual_ranks add constraint individual_ranks_nrmp_code_check
  check (nrmp_code is null or nrmp_code ~ '^[0-9]{7}[A-Z0-9][0-9]{1,2}$');
