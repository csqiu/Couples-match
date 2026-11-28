-- Beta limit, refined: it counts the people who START a couple, not their partners.
-- Anyone with a pending (unexpired, unrevoked, unaccepted) invite can always create an
-- account, so a couple is never left with one partner locked out. With the cap at 50,
-- that's up to 50 couples.
--
-- Partners who signed up through an invite are recorded here so they keep not counting
-- after their invite is accepted. No foreign key: the row is written while the auth
-- user is still being inserted. Deleted accounts drop out because counting joins on
-- auth.users.

create table public.beta_invited_signups (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.beta_invited_signups enable row level security;
revoke all on public.beta_invited_signups from public, anon, authenticated;

-- Accounts that already joined a couple as the invited partner.
insert into public.beta_invited_signups (user_id)
select distinct partner_b from public.couples where partner_b is not null
on conflict do nothing;

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

  -- Invited partners are always let in, and never count.
  if exists (
    select 1 from public.invites i
    where i.email = new.email::extensions.citext
      and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  ) then
    insert into public.beta_invited_signups (user_id) values (new.id) on conflict do nothing;
    return new;
  end if;

  select signup_limit into v_limit from public.beta_settings;
  if v_limit is null then
    return new;
  end if;
  -- Two sign-ups at the same moment can't both take the last place.
  perform pg_advisory_xact_lock(hashtext('public.enforce_signup_limit'));
  if (
    select count(*) from auth.users u
    where (u.email is null or u.email not like '%@example.test')
      and not exists (select 1 from public.beta_invited_signups b where b.user_id = u.id)
  ) >= v_limit then
    raise exception 'beta_full' using errcode = 'P0001',
      hint = 'Pairwise is in a closed beta and has no places left.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_signup_limit() from public, anon, authenticated;
