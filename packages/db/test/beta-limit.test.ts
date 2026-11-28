import { describe, expect, it } from 'vitest';
import { tx } from './db';

describe('Beta signup limit (migration 11)', () => {
  it('refuses new accounts once the cap is reached, ignoring e2e test accounts', () =>
    tx(async (db) => {
      await db.asAdmin();
      const { n } = await db.one<{ n: number }>(
        "select count(*)::int as n from auth.users where email not like '%@example.test'",
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

  it('is invisible to the API', () =>
    tx(async (db) => {
      const u = await db.createUser('reader@beta.test');
      await db.as(u);
      expect(await db.error('select * from public.beta_settings')).toMatch(/permission denied/);
    }));
});
