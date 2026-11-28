import { describe, expect, it } from 'vitest';
import { tx } from './db';

describe('Beta signup limit (migrations 16–17)', () => {
  it('refuses new accounts once the cap is reached, ignoring e2e test accounts', () =>
    tx(async (db) => {
      await db.asAdmin();
      const { n } = await db.one<{ n: number }>(
        `select count(*)::int as n from auth.users u where u.email not like '%@example.test'
           and not exists (select 1 from beta_invited_signups b where b.user_id = u.id)`,
      );
      await db.query('update public.beta_settings set signup_limit = $1', [n + 2]);
      await db.createUser('one@beta.test');
      await db.createUser('two@beta.test');
      expect(await db.error("insert into auth.users (email) values ('three@beta.test')")).toMatch(/beta_full/);
      // Test accounts are always allowed.
      await db.createUser('extra.e2e@example.test');
      // No cap: anyone can sign up.
      await db.query('update public.beta_settings set signup_limit = null');
      await db.createUser('three@beta.test');
    }));

  it('counts couple starters only: an invited partner always gets in, and never takes a place', () =>
    tx(async (db) => {
      const counted = async () => {
        await db.asAdmin();
        return (await db.one<{ n: number }>(
          `select count(*)::int as n from auth.users u where u.email not like '%@example.test'
             and not exists (select 1 from beta_invited_signups b where b.user_id = u.id)`,
        )).n;
      };
      const a = await db.createUser('starter@beta.test', { specialty: 'internal-medicine' });
      await db.asAdmin();
      await db.query('update public.beta_settings set signup_limit = $1', [await counted()]); // now full
      expect(await db.error("insert into auth.users (email) values ('stranger@beta.test')")).toMatch(/beta_full/);

      await db.as(a);
      const { id: coupleId } = await db.one<{ id: string }>(
        `insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', 2027) returning id`,
        [a.id],
      );
      const { token } = await db.one<{ token: string }>('select token from create_invite($1, $2)', [coupleId, 'Partner@Beta.test']);
      const before = await counted();
      const b = await db.createUser('partner@beta.test', { specialty: 'pediatrics' }); // full, but invited
      await db.as(b);
      await db.one('select accept_invite($1)', [token]);
      await db.asAdmin();
      expect(await counted()).toBe(before); // still doesn't count once accepted
      expect(await db.error("insert into auth.users (email) values ('stranger@beta.test')")).toMatch(/beta_full/);

      // A revoked or expired invite doesn't open the door.
      await db.asAdmin();
      await db.query(
        `insert into invites (couple_id, email, token_hash, expires_at, revoked_at) values
           ($1, 'revoked@beta.test', '\\x01', now() + interval '1 day', now()),
           ($1, 'expired@beta.test', '\\x02', now() - interval '1 day', null)`,
        [coupleId],
      );
      expect(await db.error("insert into auth.users (email) values ('revoked@beta.test')")).toMatch(/beta_full/);
      expect(await db.error("insert into auth.users (email) values ('expired@beta.test')")).toMatch(/beta_full/);
    }));

  it('is invisible to the API', () =>
    tx(async (db) => {
      const u = await db.createUser('reader@beta.test');
      await db.as(u);
      expect(await db.error('select * from public.beta_settings')).toMatch(/permission denied/);
      expect(await db.error('select * from public.beta_invited_signups')).toMatch(/permission denied/);
    }));
});
