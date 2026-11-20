-- Fixes from the Supabase database advisors on the first deploy.

-- 1. Internal helpers created after the blanket revoke in the security migration
--    were executable by anon/authenticated through /rest/v1/rpc (Postgres grants
--    EXECUTE to PUBLIC on new functions by default). They are only meant to run
--    inside triggers.
revoke all on function public.acting_user(), public.log_activity(), public.log_couple_activity(),
  public.handle_new_user(), public.enforce_one_couple_per_year(), public.handle_partner_removed(),
  public.validate_rank_program(), public.protect_list_version(), public.assign_program_cbsa()
  from public, anon, authenticated;

-- ...and make that the default for functions created later, so new ones start locked.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- 2. Fixed search_path on the remaining function that lacked one.
alter function public.protect_list_version() set search_path = '';

-- 3. Indexes for foreign keys (cascades on account deletion walk these).
create index if not exists audit_events_user_idx on public.audit_events (user_id);
create index if not exists comparisons_answered_by_idx on public.comparisons (answered_by);
create index if not exists individual_ranks_program_idx on public.individual_ranks (program_id);
create index if not exists individual_ranks_user_idx on public.individual_ranks (user_id);
create index if not exists invites_created_by_idx on public.invites (created_by);
create index if not exists list_versions_created_by_idx on public.list_versions (created_by);
create index if not exists pair_exclusions_created_by_idx on public.pair_exclusions (created_by);
create index if not exists pins_comparison_idx on public.pins (comparison_id);
create index if not exists pins_created_by_idx on public.pins (created_by);
create index if not exists profiles_specialty_idx on public.profiles (specialty);
create index if not exists rule_exceptions_created_by_idx on public.rule_exceptions (created_by);
