-- Clears everything the end-to-end tests create for the two e2e test users
-- (their couples cascade to ranks, invites, answers, versions and activity),
-- and resets their profiles. Run before `pnpm --filter @pairwise/web e2e`.
delete from public.couples c
using auth.users u
where u.email in ('alex.e2e@example.test', 'sam.e2e@example.test')
  and u.id in (c.partner_a, c.partner_b);
update public.profiles set display_name = null, specialty = null
where email in ('alex.e2e@example.test', 'sam.e2e@example.test');
