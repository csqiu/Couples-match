-- Daily purge of couples dissolved more than 30 days ago (spec Section 8).
-- Uses pg_cron where available (hosted Supabase); elsewhere this is a no-op and
-- purge_dissolved_couples() can be called by any scheduler with the service role.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('purge-dissolved-couples', '17 4 * * *', 'select public.purge_dissolved_couples()');
  end if;
end;
$$;
