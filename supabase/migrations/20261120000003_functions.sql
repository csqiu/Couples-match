-- Invites, couple lifecycle, account deletion, activity feed, distance helpers, Realtime.

-- ---------------------------------------------------------------------------
-- Partner invites (spec Section 8)
--
-- Flow: partner A creates the couple, then calls create_invite (normally via
-- the send-invite Edge Function, so the token only ever travels in the email).
-- Partner B signs in with that same email and calls accept_invite(token).

create or replace function public.create_invite(p_couple uuid, p_email text)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  cpl public.couples%rowtype;
  my_email text;
  v_token text;
  v_id uuid;
  v_expires timestamptz := now() + interval '7 days';
begin
  if me is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select * into cpl from public.couples where id = p_couple for update;
  if not found or cpl.partner_a is distinct from me then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if cpl.status <> 'pending' or cpl.partner_b is not null then
    raise exception 'couple_not_pending' using errcode = 'P0001';
  end if;
  p_email := lower(trim(p_email));
  if p_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = 'P0001';
  end if;
  select lower(u.email) into my_email from auth.users u where u.id = me;
  if p_email = my_email then
    raise exception 'cannot_invite_self' using errcode = 'P0001';
  end if;

  -- One open invite at a time: resending revokes the previous link.
  update public.invites set revoked_at = now()
  where couple_id = p_couple and accepted_at is null and revoked_at is null;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invites (couple_id, email, token_hash, expires_at, created_by)
  values (p_couple, p_email, extensions.digest(v_token, 'sha256'), v_expires, me)
  returning id into v_id;

  return query select v_id, v_token, v_expires;
end;
$$;

create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.invites i set revoked_at = now()
  from public.couples c
  where i.id = p_invite and c.id = i.couple_id
    and c.partner_a = (select auth.uid())
    and i.accepted_at is null and i.revoked_at is null;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

-- What the invite landing page shows before (and after) sign-in. The token is the secret.
create or replace function public.invite_preview(p_token text)
returns table (status text, inviter_name text, invited_email text, match_type public.match_type, match_name text, match_year int)
language sql stable security definer set search_path = ''
as $$
  select
    case
      when i.revoked_at is not null then 'revoked'
      when i.accepted_at is not null then 'accepted'
      when i.expires_at <= now() then 'expired'
      else 'valid'
    end,
    coalesce(p.display_name, 'Your partner'),
    i.email::text,
    c.match_type,
    c.match_name,
    c.match_year
  from public.invites i
  join public.couples c on c.id = i.couple_id
  left join public.profiles p on p.user_id = c.partner_a
  where i.token_hash = extensions.digest(p_token, 'sha256');
$$;

create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  inv public.invites%rowtype;
  cpl public.couples%rowtype;
  my_email text;
  spec_a public.specialties%rowtype;
  spec_b public.specialties%rowtype;
begin
  if me is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select * into inv from public.invites where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.revoked_at is not null or inv.accepted_at is not null then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  if inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = 'P0001';
  end if;
  select lower(u.email) into my_email from auth.users u where u.id = me;
  if my_email is distinct from lower(inv.email::text) then
    raise exception 'invite_email_mismatch' using errcode = 'P0001',
      detail = 'Sign in with the email address the invite was sent to.';
  end if;
  select * into cpl from public.couples where id = inv.couple_id for update;
  if cpl.status <> 'pending' or cpl.partner_b is not null or cpl.partner_a = me then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;

  -- Couples must be in the same match (when both partners have set a specialty).
  select s.* into spec_a from public.profiles p join public.specialties s on s.code = p.specialty where p.user_id = cpl.partner_a;
  select s.* into spec_b from public.profiles p join public.specialties s on s.code = p.specialty where p.user_id = me;
  if spec_b.code is not null and (spec_b.match_type <> cpl.match_type::text or spec_b.match_name <> cpl.match_name) then
    raise exception 'different_match' using errcode = 'P0001',
      detail = 'Both partners must be in the same NRMP match.';
  end if;

  update public.couples
    set partner_b = me, status = 'active', activated_at = now()
    where id = cpl.id;
  update public.invites set accepted_at = now() where id = inv.id;
  return cpl.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaving, purging, deleting an account

-- Either partner can leave. The data stays with the (now read-only) couple and
-- is purged after 30 days.
create or replace function public.leave_couple(p_couple uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.couples
    set status = 'dissolved', dissolved_at = now()
    where id = p_couple and status <> 'dissolved' and (select auth.uid()) in (partner_a, partner_b);
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

-- Run daily by a scheduled job (service role only).
create or replace function public.purge_dissolved_couples(p_older_than interval default interval '30 days')
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  n int;
begin
  delete from public.couples where status = 'dissolved' and dissolved_at < now() - p_older_than;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Account deletion purges everything about the user: profile, their rank list,
-- and their membership (the couple is dissolved, or removed if nobody is left).
create or replace function public.delete_my_account()
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  delete from auth.users where id = me;
end;
$$;

-- ---------------------------------------------------------------------------
-- Activity feed: one event per statement per couple ("Alex reordered 12 programs").

-- The acting user, or null when they no longer exist (e.g. while their account is being deleted).
create or replace function public.acting_user()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select u.id from auth.users u where u.id = (select auth.uid());
$$;

create or replace function public.log_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_events (couple_id, user_id, type, payload)
  select ch.couple_id, public.acting_user(), tg_table_name || '.' || lower(tg_op), jsonb_build_object('count', count(*))
  from changed ch
  where exists (select 1 from public.couples c where c.id = ch.couple_id)
  group by ch.couple_id;
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['individual_ranks', 'comparisons', 'pins', 'pair_exclusions', 'rule_exceptions', 'list_versions', 'invites'] loop
    execute format('create trigger %1$s_activity_ins after insert on public.%1$s referencing new table as changed for each statement execute function public.log_activity()', t);
    execute format('create trigger %1$s_activity_upd after update on public.%1$s referencing new table as changed for each statement execute function public.log_activity()', t);
    execute format('create trigger %1$s_activity_del after delete on public.%1$s referencing old table as changed for each statement execute function public.log_activity()', t);
  end loop;
end;
$$;

create or replace function public.log_couple_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.settings is distinct from old.settings then
    insert into public.audit_events (couple_id, user_id, type, payload)
    values (new.id, public.acting_user(), 'couples.settings', jsonb_build_object('changed', (
      select coalesce(jsonb_agg(k), '[]'::jsonb) from (
        select key as k from jsonb_each(new.settings)
        where new.settings -> key is distinct from old.settings -> key
        union
        select key from jsonb_each(old.settings) where not new.settings ? key
      ) keys)));
  end if;
  if new.status is distinct from old.status then
    insert into public.audit_events (couple_id, user_id, type, payload)
    values (new.id, public.acting_user(), 'couples.' || new.status::text, '{}'::jsonb);
  end if;
  return null;
end;
$$;
create trigger couples_activity
  after update on public.couples
  for each row execute function public.log_couple_activity();

-- ---------------------------------------------------------------------------
-- Distances (computed in the database so the client never has to)

create or replace function public.pair_distance_mi(p_a text, p_b text)
returns double precision
language sql stable set search_path = ''
as $$
  select extensions.st_distance(a.geom, b.geom) / 1609.344
  from public.programs a, public.programs b
  where a.id = p_a and b.id = p_b;
$$;

-- Every both-matched candidate pair of a couple with its distance and metro relation.
-- security_invoker: callers only see rows their own policies allow.
create or replace view public.couple_pair_distances
with (security_invoker = true)
as
select
  r1.couple_id,
  r1.program_id as program_a,
  r2.program_id as program_b,
  extensions.st_distance(p1.geom, p2.geom) / 1609.344 as distance_mi,
  (p1.cbsa_code is not null and p1.cbsa_code = p2.cbsa_code) as same_cbsa
from public.individual_ranks r1
join public.couples c on c.id = r1.couple_id and r1.user_id = c.partner_a
join public.individual_ranks r2 on r2.couple_id = r1.couple_id and r2.user_id = c.partner_b
join public.programs p1 on p1.id = r1.program_id
join public.programs p2 on p2.id = r2.program_id
where r1.acceptable and r2.acceptable;

-- ---------------------------------------------------------------------------
-- Grants for the functions above

revoke all on function
  public.create_invite(uuid, text), public.revoke_invite(uuid), public.invite_preview(text),
  public.accept_invite(text), public.leave_couple(uuid), public.purge_dissolved_couples(interval),
  public.delete_my_account(), public.pair_distance_mi(text, text)
  from public, anon, authenticated;

grant execute on function
  public.create_invite(uuid, text), public.revoke_invite(uuid), public.accept_invite(text),
  public.leave_couple(uuid), public.delete_my_account(), public.pair_distance_mi(text, text)
  to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.purge_dissolved_couples(interval) to service_role;
grant select on public.couple_pair_distances to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: both partners see list edits, answers and resolutions live.
-- Postgres Changes respects the RLS policies above.

do $$
declare
  t text;
begin
  foreach t in array array['couples', 'individual_ranks', 'comparisons', 'pins', 'pair_exclusions', 'rule_exceptions', 'list_versions', 'audit_events'] loop
    -- Full row images so DELETE events still carry couple_id for filtering.
    execute format('alter table public.%I replica identity full', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- Presence and broadcast ("Alex is answering comparisons") use a private channel
-- per couple, "couple:<id>"; only its members may join. Supabase only.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    execute $p$
      create policy "couple members use their channel" on realtime.messages
      for all to authenticated
      using (
        realtime.topic() ~ '^couple:[0-9a-f-]{36}$'
        and public.is_couple_member(substr(realtime.topic(), 8)::uuid)
      )
      with check (
        realtime.topic() ~ '^couple:[0-9a-f-]{36}$'
        and public.is_couple_member(substr(realtime.topic(), 8)::uuid)
      )
    $p$;
  end if;
end;
$$;
