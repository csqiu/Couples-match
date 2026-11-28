-- Beta: cap how many accounts can be created. People who already have an account
-- can always sign in; only brand-new sign-ups are refused once the cap is reached.
-- The e2e test accounts (@example.test) don't count.
--
-- Change the cap (Supabase dashboard → SQL editor):
--   update public.beta_settings set signup_limit = 100;   -- raise it
--   update public.beta_settings set signup_limit = null;  -- no cap (launch)

create table public.beta_settings (
  id boolean primary key default true check (id), -- exactly one row
  signup_limit int check (signup_limit is null or signup_limit >= 0)
);
insert into public.beta_settings (signup_limit) values (50);

-- Not readable or writable through the API: no policies, and no grants.
alter table public.beta_settings enable row level security;
revoke all on public.beta_settings from public, anon, authenticated;

create or replace function public.enforce_signup_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_limit int;
begin
  if new.email like '%@example.test' then
    return new;
  end if;
  select signup_limit into v_limit from public.beta_settings;
  if v_limit is null then
    return new;
  end if;
  -- Two sign-ups at the same moment can't both take the last place.
  perform pg_advisory_xact_lock(hashtext('public.enforce_signup_limit'));
  if (select count(*) from auth.users u where u.email is null or u.email not like '%@example.test') >= v_limit then
    raise exception 'beta_full' using errcode = 'P0001',
      hint = 'Pairwise is in a closed beta and has no places left.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_signup_limit() from public, anon, authenticated;

create trigger enforce_signup_limit
  before insert on auth.users
  for each row execute function public.enforce_signup_limit();
