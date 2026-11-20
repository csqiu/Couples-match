-- Pairwise schema (spec Section 3).
--
-- Every user table carries couple_id and is protected by row level security
-- (next migration). Programs are global and read-only to users, except
-- user-added programs, which stay private to their couple until an admin
-- approves them.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- Types

create type public.match_type as enum ('main', 'sms_fellowship');
create type public.couple_status as enum ('pending', 'active', 'dissolved');
create type public.tier as enum ('A', 'B', 'C');
create type public.comparison_winner as enum ('left', 'right', 'tie');
create type public.pin_source as enum ('comparison', 'manual_drag', 'conflict_resolution');

-- A pair of programs as the engine writes it: "<programA>|<programB>", where
-- either side may be NO_MATCH (never both).
create domain public.pair_id as text
  check (value ~ '^[^|]+\|[^|]+$' and value <> 'NO_MATCH|NO_MATCH');

-- ---------------------------------------------------------------------------
-- Reference data

-- Controlled specialty vocabulary (generated from packages/data).
create table public.specialties (
  code text primary key,
  name text not null,
  match_type text not null check (match_type in ('main', 'sms_fellowship', 'other')),
  match_name text not null
);

-- Census CBSA (metro area) boundaries, loaded from the cartographic boundary file.
create table public.cbsa_boundaries (
  cbsa_code text primary key,
  name text not null,
  lsad text,
  geom extensions.geography(MultiPolygon, 4326) not null
);
create index cbsa_boundaries_geom_idx on public.cbsa_boundaries using gist (geom);

-- ---------------------------------------------------------------------------
-- People and couples

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  specialty text references public.specialties (code),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  partner_a uuid references auth.users (id) on delete set null,
  partner_b uuid references auth.users (id) on delete set null,
  match_type public.match_type not null,
  -- e.g. "Main Residency Match" or "Medicine and Pediatric Specialties".
  match_name text not null,
  match_year int not null check (match_year between 2020 and 2100),
  status public.couple_status not null default 'pending',
  -- Overrides of the engine's CoupleSettings plus { privacy: 'shared' | 'private_tiers' }.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  dissolved_at timestamptz,
  check (partner_a is null or partner_b is null or partner_a <> partner_b)
);
create index couples_partner_a_idx on public.couples (partner_a);
create index couples_partner_b_idx on public.couples (partner_b);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  email extensions.citext not null,
  -- sha256 of the single-use token; the token itself is only ever in the email.
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index invites_couple_idx on public.invites (couple_id);

-- ---------------------------------------------------------------------------
-- Programs

create table public.programs (
  id text primary key default ('user-' || gen_random_uuid()),
  name text not null,
  institution text not null,
  specialty_code text not null references public.specialties (code),
  specialty_name text not null,
  match_type public.match_type not null,
  match_name text not null,
  nrmp_code text,
  acgme_id text,
  city text not null default '',
  state text not null default '',
  address text not null default '',
  lat double precision check (lat between -90 and 90),
  lon double precision check (lon between -180 and 180),
  geom extensions.geography(Point, 4326) generated always as (
    case when lat is null or lon is null then null
         else extensions.st_setsrid(extensions.st_makepoint(lon, lat), 4326)::extensions.geography end
  ) stored,
  geocode_confidence real check (geocode_confidence between 0 and 1),
  geocode_source text check (geocode_source in ('census', 'nominatim', 'manual')),
  cbsa_code text,
  cbsa_name text,
  is_advanced boolean not null default false,
  source text not null,
  verified boolean not null default false,
  created_by_couple uuid references public.couples (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((lat is null) = (lon is null))
);
create index programs_specialty_idx on public.programs (specialty_code);
create index programs_couple_idx on public.programs (created_by_couple) where created_by_couple is not null;
create index programs_geom_idx on public.programs using gist (geom);

-- ---------------------------------------------------------------------------
-- A couple's working state (the "draft" — autosaved continuously)

create table public.individual_ranks (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  program_id text not null references public.programs (id),
  rank int not null check (rank between 1 and 300),
  tier public.tier not null,
  acceptable boolean not null default true,
  note text,
  -- The NRMP code the user typed from R3. Stored per couple, never written back globally.
  nrmp_code text check (nrmp_code is null or nrmp_code ~ '^[0-9]{7}[A-Z0-9][0-9]$'),
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id, program_id),
  -- Deferrable so a drag-and-drop reorder can rewrite ranks in one statement.
  constraint individual_ranks_rank_unique unique (couple_id, user_id, rank) deferrable initially deferred
);

create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  pair_left public.pair_id not null,
  pair_right public.pair_id not null,
  winner public.comparison_winner not null,
  answered_by uuid references auth.users (id) on delete set null,
  both_agreed boolean not null default false,
  locked boolean not null default false,
  seq bigint generated always as identity,
  created_at timestamptz not null default now(),
  check (pair_left <> pair_right)
);
create index comparisons_couple_idx on public.comparisons (couple_id, seq);

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  higher_pair public.pair_id not null,
  lower_pair public.pair_id not null,
  source public.pin_source not null,
  comparison_id uuid references public.comparisons (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (higher_pair <> lower_pair)
);
create index pins_couple_idx on public.pins (couple_id);

create table public.pair_exclusions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  program_a text not null,
  program_b text not null,
  reason text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (couple_id, program_a, program_b)
);

-- Rule links the couple chose to break while resolving a cycle (engine RuleException).
create table public.rule_exceptions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  higher_pair public.pair_id not null,
  lower_pair public.pair_id not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (couple_id, higher_pair, lower_pair)
);

-- ---------------------------------------------------------------------------
-- Versions and activity

create table public.list_versions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  engine_version text not null,
  inputs_snapshot jsonb not null,
  pairs jsonb not null check (jsonb_typeof(pairs) = 'array'),
  is_frozen boolean not null default true check (is_frozen)
);
create index list_versions_couple_idx on public.list_versions (couple_id, created_at desc);

create table public.audit_events (
  id bigint generated always as identity primary key,
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_couple_idx on public.audit_events (couple_id, created_at desc);
