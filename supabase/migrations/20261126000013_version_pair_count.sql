-- Bug log #30: pages list versions with their row counts without downloading every
-- version's frozen list (up to 300 rows each). Kept by the database, so it can't drift.
alter table public.list_versions
  add column pair_count int generated always as (jsonb_array_length(pairs)) stored;
