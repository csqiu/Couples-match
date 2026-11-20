-- TEST-ONLY stand-ins for the parts of Supabase the migrations rely on, so they
-- can be tested against a plain Postgres + PostGIS. Every statement is guarded:
-- on a real Supabase database (local `supabase start` or hosted) this file does
-- nothing. Never applied in production.
--
-- Mirrors Supabase's behaviour where it matters for RLS:
--   - roles anon / authenticated / service_role (service_role bypasses RLS);
--   - auth.users;
--   - auth.uid() / auth.jwt() / auth.role() read the `request.jwt.claims` setting,
--     exactly as PostgREST sets it per request;
--   - the supabase_realtime publication.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

do $$
begin
  if to_regclass('auth.users') is not null then
    return; -- a real Supabase database: leave it alone
  end if;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    created_at timestamptz not null default now()
  );

  create function auth.jwt() returns jsonb language sql stable as
    $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
  create function auth.uid() returns uuid language sql stable as
    $f$ select nullif(auth.jwt() ->> 'sub', '')::uuid $f$;
  create function auth.role() returns text language sql stable as
    $f$ select coalesce(auth.jwt() ->> 'role', 'anon') $f$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
alter default privileges in schema extensions grant execute on functions to anon, authenticated, service_role;

grant usage on schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
