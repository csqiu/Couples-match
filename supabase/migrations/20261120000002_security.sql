-- Row level security, integrity triggers and grants.
--
-- Principle: a row in a couple's tables is visible only to the two members of
-- that couple. Writes that change who belongs to a couple go through
-- SECURITY DEFINER functions (next migration), never through direct updates.

-- ---------------------------------------------------------------------------
-- Membership helpers (SECURITY DEFINER so policies can use them without recursion)

create or replace function public.is_couple_member(p_couple uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.couples c
    where c.id = p_couple and (select auth.uid()) in (c.partner_a, c.partner_b)
  );
$$;

-- Members of a couple that is not dissolved may change its data.
create or replace function public.is_active_member(p_couple uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.couples c
    where c.id = p_couple
      and c.status <> 'dissolved'
      and (select auth.uid()) in (c.partner_a, c.partner_b)
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.user_id = (select auth.uid())), false);
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers

-- New auth user → profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (new.id, coalesce(new.email, ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- A user can belong to only one non-dissolved couple per match year.
create or replace function public.enforce_one_couple_per_year()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  member uuid;
begin
  if new.status = 'dissolved' then
    return new;
  end if;
  foreach member in array array_remove(array[new.partner_a, new.partner_b], null) loop
    perform pg_advisory_xact_lock(hashtext('couple-year:' || member::text || ':' || new.match_year));
    if exists (
      select 1 from public.couples c
      where c.id <> new.id
        and c.match_year = new.match_year
        and c.status <> 'dissolved'
        and member in (c.partner_a, c.partner_b)
    ) then
      raise exception 'already_in_couple' using
        detail = 'A user can belong to only one active couple per match year.',
        errcode = 'P0001';
    end if;
  end loop;
  return new;
end;
$$;
create trigger couples_one_per_year
  before insert or update of partner_a, partner_b, status, match_year on public.couples
  for each row execute function public.enforce_one_couple_per_year();

-- When a partner deletes their account: a couple with nobody left is removed;
-- a couple with one partner left is dissolved (purged after 30 days).
create or replace function public.handle_partner_removed()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.partner_a is null and new.partner_b is null then
    delete from public.couples where id = new.id;
  elsif (old.partner_a is not null and new.partner_a is null)
     or (old.partner_b is not null and new.partner_b is null) then
    update public.couples
      set status = 'dissolved', dissolved_at = coalesce(dissolved_at, now())
      where id = new.id and status <> 'dissolved';
  end if;
  return null;
end;
$$;
create trigger couples_partner_removed
  after update of partner_a, partner_b on public.couples
  for each row execute function public.handle_partner_removed();

-- A rank row must point at a program the couple may use, in the couple's match.
create or replace function public.validate_rank_program()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  prog record;
  cpl record;
begin
  select p.match_type, p.created_by_couple into prog from public.programs p where p.id = new.program_id;
  select c.match_type into cpl from public.couples c where c.id = new.couple_id;
  if prog.created_by_couple is not null and prog.created_by_couple <> new.couple_id then
    raise exception 'program_not_available' using errcode = 'P0001';
  end if;
  if prog.match_type <> cpl.match_type then
    raise exception 'program_wrong_match' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger individual_ranks_validate
  before insert or update on public.individual_ranks
  for each row execute function public.validate_rank_program();

-- Versions are immutable apart from their name and note.
create or replace function public.protect_list_version()
returns trigger
language plpgsql
as $$
begin
  if (new.couple_id, new.created_at, new.engine_version, new.inputs_snapshot, new.pairs, new.is_frozen)
     is distinct from
     (old.couple_id, old.created_at, old.engine_version, old.inputs_snapshot, old.pairs, old.is_frozen)
     -- The author may only become unknown (their account was deleted).
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'version_is_frozen' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger list_versions_protect
  before update on public.list_versions
  for each row execute function public.protect_list_version();

-- Programs get a metro area from the CBSA boundaries when their location changes
-- (only when boundaries are loaded; otherwise the given cbsa_code is kept).
create or replace function public.assign_program_cbsa()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  hit record;
begin
  if new.lat is null or not exists (select 1 from public.cbsa_boundaries) then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.lat is not distinct from old.lat and new.lon is not distinct from old.lon then
    return new;
  end if;
  select b.cbsa_code, b.name into hit
  from public.cbsa_boundaries b
  where extensions.st_intersects(
    b.geom,
    extensions.st_setsrid(extensions.st_makepoint(new.lon, new.lat), 4326)::extensions.geography
  )
  order by b.lsad nulls last
  limit 1;
  new.cbsa_code := hit.cbsa_code;
  new.cbsa_name := hit.name;
  return new;
end;
$$;
create trigger programs_assign_cbsa
  before insert or update of lat, lon on public.programs
  for each row execute function public.assign_program_cbsa();

-- ---------------------------------------------------------------------------
-- Row level security

alter table public.specialties enable row level security;
alter table public.cbsa_boundaries enable row level security;
alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.invites enable row level security;
alter table public.programs enable row level security;
alter table public.individual_ranks enable row level security;
alter table public.comparisons enable row level security;
alter table public.pins enable row level security;
alter table public.pair_exclusions enable row level security;
alter table public.rule_exceptions enable row level security;
alter table public.list_versions enable row level security;
alter table public.audit_events enable row level security;

-- Reference data: readable by signed-in users.
create policy "specialties are readable" on public.specialties for select to authenticated using (true);
create policy "cbsa boundaries are readable" on public.cbsa_boundaries for select to authenticated using (true);

-- Profiles: your own, and your partner's.
create policy "read own or partner profile" on public.profiles for select to authenticated using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.couples c
    where (select auth.uid()) in (c.partner_a, c.partner_b) and profiles.user_id in (c.partner_a, c.partner_b)
  )
);
create policy "update own profile" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Couples: members read; anyone signed in may start a couple with themselves as partner A.
-- Checks the row's own columns (not is_couple_member) so `insert ... returning` works
-- on the row being inserted.
create policy "members read couple" on public.couples for select to authenticated
  using ((select auth.uid()) in (partner_a, partner_b));
create policy "start a couple" on public.couples for insert to authenticated
  with check (partner_a = (select auth.uid()) and partner_b is null and status = 'pending');
create policy "members update settings" on public.couples for update to authenticated
  using (public.is_active_member(id)) with check (public.is_active_member(id));

-- Invites: members can see their couple's invites; all changes go through functions.
create policy "members read invites" on public.invites for select to authenticated
  using (public.is_couple_member(couple_id));

-- Programs: global programs for everyone; user-added ones only for their couple; admins see all.
create policy "read programs" on public.programs for select to authenticated using (
  created_by_couple is null or public.is_couple_member(created_by_couple) or public.is_admin()
);
create policy "add a program for your couple" on public.programs for insert to authenticated with check (
  created_by_couple is not null
  and public.is_active_member(created_by_couple)
  and verified = false
  and source = 'user'
);
create policy "admins update programs" on public.programs for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admins delete programs" on public.programs for delete to authenticated
  using (public.is_admin());

-- Individual ranks: both members read; each partner writes only their own list.
create policy "members read ranks" on public.individual_ranks for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "write own ranks" on public.individual_ranks for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_member(couple_id));
create policy "update own ranks" on public.individual_ranks for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member(couple_id))
  with check (user_id = (select auth.uid()) and public.is_active_member(couple_id));
create policy "delete own ranks" on public.individual_ranks for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member(couple_id));

-- Comparisons: members read and write; you can only record your own answers.
create policy "members read comparisons" on public.comparisons for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "record own answer" on public.comparisons for insert to authenticated
  with check (answered_by = (select auth.uid()) and public.is_active_member(couple_id));
create policy "members update comparisons" on public.comparisons for update to authenticated
  using (public.is_active_member(couple_id)) with check (public.is_active_member(couple_id));
create policy "members delete comparisons" on public.comparisons for delete to authenticated
  using (public.is_active_member(couple_id));

-- Pins, exclusions, rule exceptions: shared couple state.
create policy "members read pins" on public.pins for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members add pins" on public.pins for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_active_member(couple_id));
create policy "members delete pins" on public.pins for delete to authenticated
  using (public.is_active_member(couple_id));

create policy "members read exclusions" on public.pair_exclusions for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members add exclusions" on public.pair_exclusions for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_active_member(couple_id));
create policy "members delete exclusions" on public.pair_exclusions for delete to authenticated
  using (public.is_active_member(couple_id));

create policy "members read exceptions" on public.rule_exceptions for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members add exceptions" on public.rule_exceptions for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_active_member(couple_id));
create policy "members delete exceptions" on public.rule_exceptions for delete to authenticated
  using (public.is_active_member(couple_id));

-- Versions: members read, save and rename (the trigger keeps the content frozen).
create policy "members read versions" on public.list_versions for select to authenticated
  using (public.is_couple_member(couple_id));
create policy "members save versions" on public.list_versions for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_active_member(couple_id));
create policy "members rename versions" on public.list_versions for update to authenticated
  using (public.is_active_member(couple_id)) with check (public.is_active_member(couple_id));

-- Activity feed: read-only for members; written by triggers.
create policy "members read activity" on public.audit_events for select to authenticated
  using (public.is_couple_member(couple_id));

-- ---------------------------------------------------------------------------
-- Grants. Anonymous users get nothing; signed-in users get only what the
-- policies above can allow, narrowed by column where it matters.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.specialties, public.cbsa_boundaries to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, specialty) on public.profiles to authenticated;
grant select, insert on public.couples to authenticated;
grant update (settings) on public.couples to authenticated;
grant select on public.invites to authenticated;
grant select on public.programs to authenticated;
grant insert (name, institution, specialty_code, specialty_name, match_type, match_name, city, state, address,
              lat, lon, geocode_confidence, geocode_source, source, verified, created_by_couple)
  on public.programs to authenticated;
grant update, delete on public.programs to authenticated; -- admins only, by policy
grant select, insert, update, delete on public.individual_ranks to authenticated;
grant select, insert, delete on public.comparisons to authenticated;
grant update (winner, both_agreed, locked) on public.comparisons to authenticated;
grant select, insert, delete on public.pins, public.pair_exclusions, public.rule_exceptions to authenticated;
grant select, insert on public.list_versions to authenticated;
grant update (name, note) on public.list_versions to authenticated;
grant select on public.audit_events to authenticated;

grant execute on function public.is_couple_member(uuid), public.is_active_member(uuid), public.is_admin()
  to authenticated;
