import { describe, expect, it } from 'vitest';
import { activeCouple, tx, type Db, type User } from './db';

const P1 = 'seed-mgh-internal-medicine';
const P2 = 'seed-jhh-internal-medicine';
const K1 = 'seed-bch-pediatrics';
const K2 = 'seed-cnh-pediatrics';

/** Fills a couple with one row in every table, as its members would. */
async function populate(db: Db, a: User, b: User, coupleId: string) {
  await db.as(a);
  await db.query(
    `insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 1, 'A'), ($1, $2, $4, 2, 'B')`,
    [coupleId, a.id, P1, P2],
  );
  await db.as(b);
  await db.query(
    `insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 1, 'A'), ($1, $2, $4, 2, 'B')`,
    [coupleId, b.id, K1, K2],
  );
  const { id: cmp } = await db.one<{ id: string }>(
    `insert into comparisons (couple_id, pair_left, pair_right, winner, answered_by) values ($1, $2, $3, 'left', $4) returning id`,
    [coupleId, `${P1}|${K1}`, `${P2}|${K2}`, b.id],
  );
  await db.query(`insert into pins (couple_id, higher_pair, lower_pair, source, comparison_id, created_by) values ($1, $2, $3, 'comparison', $4, $5)`, [
    coupleId, `${P1}|${K1}`, `${P2}|${K2}`, cmp, b.id,
  ]);
  await db.query(`insert into pair_exclusions (couple_id, program_a, program_b, created_by) values ($1, $2, $3, $4)`, [coupleId, P2, K1, b.id]);
  await db.query(`insert into rule_exceptions (couple_id, higher_pair, lower_pair, created_by) values ($1, $2, $3, $4)`, [
    coupleId, `${P2}|${K1}`, `${P1}|${K2}`, b.id,
  ]);
  await db.query(
    `insert into list_versions (couple_id, name, created_by, engine_version, inputs_snapshot, pairs) values ($1, 'Draft 1', $2, '0.2.0', '{}', '[]')`,
    [coupleId, b.id],
  );
  await db.as(a);
  await db.one(
    `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, city, state, lat, lon, source, verified, created_by_couple)
     values ('Community Hospital — IM', 'Community Hospital', 'internal-medicine', 'Internal Medicine', 'main', 'Main Residency Match', 'Quincy', 'MA', 42.25, -71.0, 'user', false, $1)
     returning id`,
    [coupleId],
  );
}

const COUPLE_TABLES = ['individual_ranks', 'comparisons', 'pins', 'pair_exclusions', 'rule_exceptions', 'list_versions', 'audit_events', 'invites'];

describe('Partner invites', () => {
  it('A creates a pending couple and invites B; B signs in with that email and accepts', () =>
    tx(async (db) => {
      const a = await db.createUser('alex@example.com', { name: 'Alex' });
      const b = await db.createUser('Sam@Example.com');
      await db.as(a);
      const { id } = await db.one<{ id: string }>(
        `insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', 2027) returning id`,
        [a.id],
      );
      const inv = await db.one<{ token: string; expires_at: Date }>('select * from create_invite($1, $2)', [id, ' sam@example.com ']);
      expect(inv.token).toMatch(/^[0-9a-f]{64}$/);
      const days = (inv.expires_at.getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(6.9);
      expect(days).toBeLessThan(7.1);

      // The token is never stored, only its hash.
      await db.asAdmin();
      const stored = await db.one<{ hex: string }>("select encode(token_hash, 'hex') as hex from invites where couple_id = $1", [id]);
      expect(stored.hex).not.toBe(inv.token);

      // Landing page works before sign-in.
      await db.as(null);
      expect(await db.one('select status, inviter_name, invited_email, match_year from invite_preview($1)', [inv.token])).toEqual({
        status: 'valid',
        inviter_name: 'Alex',
        invited_email: 'sam@example.com',
        match_year: 2027,
      });

      await db.as(b);
      expect(await db.one('select accept_invite($1) as couple', [inv.token])).toEqual({ couple: id });
      const couple = await db.one('select status, partner_b from couples where id = $1', [id]);
      expect(couple).toEqual({ status: 'active', partner_b: b.id });

      // Single use.
      expect(await db.error('select accept_invite($1)', [inv.token])).toMatch(/invite_invalid/);
    }));

  it('rejects the wrong email, expired, revoked and resent (superseded) links', () =>
    tx(async (db) => {
      const a = await db.createUser('a@example.com');
      const b = await db.createUser('b@example.com');
      const eve = await db.createUser('eve@example.com');
      await db.as(a);
      const { id } = await db.one<{ id: string }>(
        `insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', 2027) returning id`,
        [a.id],
      );
      const first = (await db.one<{ token: string }>('select token from create_invite($1, $2)', [id, b.email])).token;
      const second = (await db.one<{ token: string }>('select token from create_invite($1, $2)', [id, b.email])).token; // resend

      await db.as(eve);
      expect(await db.error('select accept_invite($1)', [second])).toMatch(/invite_email_mismatch/);
      await db.as(b);
      expect(await db.error('select accept_invite($1)', [first])).toMatch(/invite_invalid/); // superseded by the resend

      await db.asAdmin();
      await db.query("update invites set expires_at = now() - interval '1 minute' where couple_id = $1 and revoked_at is null", [id]);
      await db.as(b);
      expect(await db.error('select accept_invite($1)', [second])).toMatch(/invite_expired/);

      await db.as(a);
      const third = await db.one<{ invite_id: string; token: string }>('select invite_id, token from create_invite($1, $2)', [id, b.email]);
      await db.query('select revoke_invite($1)', [third.invite_id]);
      await db.as(b);
      expect(await db.error('select accept_invite($1)', [third.token])).toMatch(/invite_invalid/);
      expect(await db.error('select accept_invite($1)', ['not-a-token'])).toMatch(/invite_invalid/);
    }));

  it('only partner A can invite, not to themselves, and only while the couple is pending', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await db.as(b);
      expect(await db.error('select create_invite($1, $2)', [coupleId, 'x@example.com'])).toMatch(/not_allowed/);
      await db.as(a);
      expect(await db.error('select create_invite($1, $2)', [coupleId, 'x@example.com'])).toMatch(/couple_not_pending/);

      const c = await db.createUser('c@example.com');
      await db.as(c);
      const { id } = await db.one<{ id: string }>(
        `insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', 2027) returning id`,
        [c.id],
      );
      expect(await db.error('select create_invite($1, $2)', [id, 'C@example.com'])).toMatch(/cannot_invite_self/);
      expect(await db.error('select create_invite($1, $2)', [id, 'not an email'])).toMatch(/invalid_email/);
    }));

  it('partners must be in the same match', () =>
    tx(async (db) => {
      const a = await db.createUser('a@example.com', { specialty: 'internal-medicine' });
      const b = await db.createUser('b@example.com', { specialty: 'cardiovascular-disease' });
      await db.as(a);
      const { id } = await db.one<{ id: string }>(
        `insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', 2027) returning id`,
        [a.id],
      );
      const { token } = await db.one<{ token: string }>('select token from create_invite($1, $2)', [id, b.email]);
      await db.as(b);
      expect(await db.error('select accept_invite($1)', [token])).toMatch(/different_match/);
    }));

  it('a user belongs to only one active couple per match year', () =>
    tx(async (db) => {
      const { a, b } = await activeCouple(db, { year: 2027 });
      const insert = `insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', $2)`;
      await db.as(a);
      expect(await db.error(insert, [a.id, 2027])).toMatch(/already_in_couple/);
      await db.query(insert, [a.id, 2028]); // a different year is fine

      // B can't be pulled into a second 2027 couple either.
      const c = await db.createUser('c@example.com');
      await db.as(c);
      const { id } = await db.one<{ id: string }>(`${insert} returning id`, [c.id, 2027]);
      const { token } = await db.one<{ token: string }>('select token from create_invite($1, $2)', [id, b.email]);
      await db.as(b);
      expect(await db.error('select accept_invite($1)', [token])).toMatch(/already_in_couple/);
    }));
});

describe('Row level security', () => {
  it('a third user cannot read or change anything belonging to the couple', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);

      // Members see everything.
      await db.as(a);
      for (const t of COUPLE_TABLES) {
        expect((await db.query(`select 1 from ${t} where couple_id = $1`, [coupleId])).length, t).toBeGreaterThan(0);
      }

      const eve = await db.createUser('eve@example.com');
      await db.as(eve);
      expect(await db.query('select * from couples where id = $1', [coupleId])).toEqual([]);
      for (const t of COUPLE_TABLES) {
        expect(await db.query(`select * from ${t} where couple_id = $1`, [coupleId]), t).toEqual([]);
      }
      expect(await db.query('select * from couple_pair_distances where couple_id = $1', [coupleId])).toEqual([]);
      expect(await db.query("select * from programs where source = 'user'")).toEqual([]);
      expect(await db.query('select * from profiles where user_id in ($1, $2)', [a.id, b.id])).toEqual([]);

      // Writes are refused or silently affect nothing.
      expect(
        await db.error(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 1, 'A')`, [coupleId, eve.id, P1]),
      ).toMatch(/row-level security/);
      expect(
        await db.error(`insert into comparisons (couple_id, pair_left, pair_right, winner, answered_by) values ($1, $2, $3, 'left', $4)`, [
          coupleId, `${P1}|${K1}`, `${P2}|${K2}`, eve.id,
        ]),
      ).toMatch(/row-level security/);
      expect(await db.query(`update couples set settings = '{"balance": 2}' where id = $1 returning id`, [coupleId])).toEqual([]);
      expect(await db.query('delete from pins where couple_id = $1 returning id', [coupleId])).toEqual([]);
      expect(await db.query("update list_versions set name = 'mine' where couple_id = $1 returning id", [coupleId])).toEqual([]);
      expect(await db.error('select leave_couple($1)', [coupleId])).toMatch(/not_allowed/);

      // Nothing changed.
      await db.asAdmin();
      expect((await db.one<{ n: string }>('select count(*) as n from pins where couple_id = $1', [coupleId])).n).toBe('1');
    }));

  it('anonymous visitors can read nothing', () =>
    tx(async (db) => {
      await activeCouple(db);
      await db.as(null);
      for (const t of ['couples', 'profiles', 'programs', 'specialties', ...COUPLE_TABLES]) {
        expect(await db.error(`select * from ${t} limit 1`), t).toMatch(/permission denied/);
      }
    }));

  it('only the intended functions are callable through the API (advisor check)', () =>
    tx(async (db) => {
      await db.asAdmin();
      const rows = await db.query<{ fn: string; anon: boolean; auth: boolean }>(`
        select p.proname as fn,
               has_function_privilege('anon', p.oid, 'execute') as anon,
               has_function_privilege('authenticated', p.oid, 'execute') as auth
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
        order by 1`);
      const callable = (role: 'anon' | 'auth') => rows.filter((r) => r[role]).map((r) => r.fn);
      expect(callable('anon')).toEqual(['invite_preview']);
      expect(callable('auth')).toEqual([
        'accept_invite', 'create_invite', 'delete_my_account', 'invite_preview', 'is_active_member',
        'is_admin', 'is_couple_member', 'leave_couple', 'revoke_invite',
      ]);
      // Every security-definer function pins its search_path.
      const unpinned = await db.query(`
        select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prolang <> (select oid from pg_language where lanname = 'c')
          and p.proname not like 'st\\_%' and not exists (
            select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
          and p.proname in (select routine_name from information_schema.routines where routine_schema = 'public')`);
      expect(unpinned).toEqual([]);
    }));

  it("each partner edits only their own rank list, but both can see both", () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);
      await db.as(a);
      expect((await db.query('select * from individual_ranks where couple_id = $1', [coupleId])).length).toBe(4);
      expect(
        await db.error(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 3, 'C')`, [coupleId, b.id, K1]),
      ).toMatch(/row-level security/);
      expect(await db.query("update individual_ranks set tier = 'C' where user_id = $1 returning 1", [b.id])).toEqual([]);
      expect(await db.query('delete from individual_ranks where user_id = $1 returning 1', [b.id])).toEqual([]);
      // Recording an answer in the partner's name is refused.
      expect(
        await db.error(`insert into comparisons (couple_id, pair_left, pair_right, winner, answered_by) values ($1, $2, $3, 'left', $4)`, [
          coupleId, `${P1}|${K1}`, `${P2}|${K2}`, b.id,
        ]),
      ).toMatch(/row-level security/);
    }));

  it('a drag-and-drop reorder can swap ranks in one statement', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);
      await db.as(a);
      await db.query(
        `update individual_ranks set rank = case program_id when $2 then 2 when $3 then 1 end where couple_id = $1 and user_id = $4`,
        [coupleId, P1, P2, a.id],
      );
      const rows = await db.query('select program_id, rank from individual_ranks where user_id = $1 order by rank', [a.id]);
      expect(rows.map((r) => r.program_id)).toEqual([P2, P1]);
    }));

  it('members cannot change who is in the couple, its status or its match — only settings', () =>
    tx(async (db) => {
      const { a, coupleId } = await activeCouple(db);
      const eve = await db.createUser('eve@example.com');
      await db.as(a);
      expect(await db.error('update couples set partner_b = $2 where id = $1', [coupleId, eve.id])).toMatch(/permission denied/);
      expect(await db.error("update couples set status = 'pending' where id = $1", [coupleId])).toMatch(/permission denied/);
      expect(await db.error('update couples set match_year = 2030 where id = $1', [coupleId])).toMatch(/permission denied/);
      expect(await db.query(`update couples set settings = '{"privacy": "private_tiers"}' where id = $1 returning id`, [coupleId])).toHaveLength(1);
      expect(await db.error('update profiles set is_admin = true where user_id = $1', [a.id])).toMatch(/permission denied/);
      expect(await db.error(`insert into audit_events (couple_id, type) values ($1, 'fake')`, [coupleId])).toMatch(/permission denied/);
    }));
});

describe('Programs', () => {
  it('user-added programs are private to the couple, unverified, and reviewable by admins', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);
      await db.as(b);
      const [added] = await db.query<{ id: string; cbsa_code: string | null; verified: boolean }>(
        "select id, verified from programs where source = 'user'",
      );
      expect(added.id).toMatch(/^user-/);
      expect(added.verified).toBe(false);

      // Can't sneak in a "verified" or global program.
      const insert = `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, source, verified, created_by_couple)
        values ('X', 'X', 'pediatrics', 'Pediatrics', 'main', 'Main Residency Match', $1, $2, $3)`;
      expect(await db.error(insert, ['user', true, coupleId])).toMatch(/row-level security/);
      expect(await db.error(insert, ['user', false, null])).toMatch(/row-level security/);
      expect(await db.error(insert, ['acgme', false, coupleId])).toMatch(/row-level security/);
      expect(await db.query('update programs set verified = true where id = $1 returning 1', [added.id])).toEqual([]);

      const admin = await db.createUser('admin@example.com', { admin: true });
      await db.as(admin);
      expect(await db.query('select id from programs where id = $1', [added.id])).toHaveLength(1);
      expect(await db.query('update programs set verified = true where id = $1 returning id', [added.id])).toHaveLength(1);
    }));

  it('a couple cannot rank another couple’s private program, or a program from another match', () =>
    tx(async (db) => {
      const one = await activeCouple(db);
      await populate(db, one.a, one.b, one.coupleId);
      await db.asAdmin();
      const { id: privateId } = await db.one<{ id: string }>("select id from programs where created_by_couple = $1", [one.coupleId]);
      const { id: fellowship } = await db.one<{ id: string }>(
        `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, source)
         values ('Cards', 'X', 'cardiovascular-disease', 'Cardiovascular Disease', 'sms_fellowship', 'Medicine and Pediatric Specialties', 'test') returning id`,
      );

      const two = await activeCouple(db);
      await db.as(two.a);
      const insert = `insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 1, 'A')`;
      expect(await db.error(insert, [two.coupleId, two.a.id, privateId])).toMatch(/program_not_available/);
      expect(await db.error(insert, [two.coupleId, two.a.id, fellowship])).toMatch(/program_wrong_match/);
    }));

  it('assigns a metro area from CBSA boundaries when they are loaded', () =>
    tx(async (db) => {
      await db.asAdmin();
      await db.query(`insert into cbsa_boundaries (cbsa_code, name, lsad, geom) values
        ('99990', 'Test Metro', 'M1', extensions.st_geogfromtext('MULTIPOLYGON(((-71.5 42, -70.5 42, -70.5 43, -71.5 43, -71.5 42)))'))`);
      const { cbsa_code } = await db.one<{ cbsa_code: string | null }>(
        `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, source, lat, lon)
         values ('In', 'X', 'pediatrics', 'Pediatrics', 'main', 'Main Residency Match', 'test', 42.3, -71.1) returning cbsa_code`,
      );
      expect(cbsa_code).toBe('99990');
      const out = await db.one<{ cbsa_code: string | null }>(
        `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, source, lat, lon)
         values ('Out', 'X', 'pediatrics', 'Pediatrics', 'main', 'Main Residency Match', 'test', 30, -95) returning cbsa_code`,
      );
      expect(out.cbsa_code).toBeNull();
    }));

  it('computes distances in the database', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);
      await db.as(a);
      const rows = await db.query<{ program_a: string; program_b: string; distance_mi: number; same_cbsa: boolean }>(
        'select * from couple_pair_distances where couple_id = $1 order by distance_mi',
        [coupleId],
      );
      expect(rows).toHaveLength(4);
      expect(rows[0]).toMatchObject({ program_a: P1, program_b: K1, same_cbsa: true });
      expect(rows[0].distance_mi).toBeLessThan(5);
      const { d } = await db.one<{ d: number }>('select pair_distance_mi($1, $2) as d', [P2, K2]);
      expect(d).toBeGreaterThan(30);
      expect(d).toBeLessThan(40);
    }));
});

describe('Versions and activity', () => {
  it('versions can be renamed but never altered', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);
      await db.as(a);
      expect(await db.query("update list_versions set name = 'Final', note = 'agreed' where couple_id = $1 returning name", [coupleId])).toEqual([
        { name: 'Final' },
      ]);
      expect(await db.error(`update list_versions set pairs = '["x"]' where couple_id = $1`, [coupleId])).toMatch(/permission denied/);
      expect(await db.error('delete from list_versions where couple_id = $1', [coupleId])).toMatch(/permission denied/);
      await db.asService();
      expect(await db.error(`update list_versions set pairs = '["x"]' where couple_id = $1`, [coupleId])).toMatch(/version_is_frozen/);
    }));

  it('records one activity event per change, not one per row', () =>
    tx(async (db) => {
      const { a, coupleId } = await activeCouple(db);
      await db.as(a);
      await db.query(
        `insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 1, 'A'), ($1, $2, $4, 2, 'B')`,
        [coupleId, a.id, P1, P2],
      );
      await db.query(`update couples set settings = '{"balance": 1.2}' where id = $1`, [coupleId]);
      const events = await db.query<{ type: string; payload: unknown; user_id: string }>(
        'select type, payload, user_id from audit_events where couple_id = $1 order by id',
        [coupleId],
      );
      expect(events.map((e) => e.type)).toEqual(['invites.insert', 'couples.active', 'invites.update', 'individual_ranks.insert', 'couples.settings']);
      expect(events[3]).toMatchObject({ payload: { count: 2 }, user_id: a.id });
      expect(events[4].payload).toEqual({ changed: ['balance'] });
    }));
});

describe('Leaving, purging, deleting an account', () => {
  it('leaving dissolves the couple: still readable, no longer editable, purged after 30 days', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);
      await db.as(b);
      await db.query('select leave_couple($1)', [coupleId]);
      await db.as(a);
      expect(await db.one('select status from couples where id = $1', [coupleId])).toEqual({ status: 'dissolved' });
      expect((await db.query('select 1 from individual_ranks where couple_id = $1', [coupleId])).length).toBe(4);
      expect(
        await db.error(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 3, 'C')`, [
          coupleId, a.id, 'seed-bidmc-internal-medicine',
        ]),
      ).toMatch(/row-level security/);
      // Both can start over in the same year.
      await db.query(`insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', 2027)`, [a.id]);

      // Purge is a server job, not something users can call.
      expect(await db.error('select purge_dissolved_couples()')).toMatch(/permission denied/);
      await db.asService();
      expect(await db.one('select purge_dissolved_couples() as n')).toEqual({ n: 0 }); // too recent
      await db.asAdmin();
      await db.query("update couples set dissolved_at = now() - interval '31 days' where id = $1", [coupleId]);
      await db.asService();
      expect(await db.one('select purge_dissolved_couples() as n')).toEqual({ n: 1 });
      await db.asAdmin();
      expect(await db.query('select 1 from individual_ranks where couple_id = $1', [coupleId])).toEqual([]);
    }));

  it('deleting an account purges that user; the partner keeps the couple read-only; nobody left → gone', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await populate(db, a, b, coupleId);
      await db.as(b);
      await db.query('select delete_my_account()');
      await db.asAdmin();
      expect(await db.query('select 1 from auth.users where id = $1', [b.id])).toEqual([]);
      expect(await db.query('select 1 from profiles where user_id = $1', [b.id])).toEqual([]);
      expect(await db.query('select 1 from individual_ranks where user_id = $1', [b.id])).toEqual([]);
      expect(await db.query('select 1 from comparisons where answered_by = $1', [b.id])).toEqual([]);

      await db.as(a);
      expect(await db.one('select status, partner_b from couples where id = $1', [coupleId])).toEqual({ status: 'dissolved', partner_b: null });
      expect((await db.query('select 1 from individual_ranks where couple_id = $1', [coupleId])).length).toBe(2);

      await db.query('select delete_my_account()');
      await db.asAdmin();
      expect(await db.query('select 1 from couples where id = $1', [coupleId])).toEqual([]);
      expect(await db.query("select 1 from programs where source = 'user' and created_by_couple = $1", [coupleId])).toEqual([]);
    }));
});

describe('Realtime', () => {
  it('publishes every table both partners need to see live, with full row images', () =>
    tx(async (db) => {
      await db.asAdmin();
      const rows = await db.query<{ tablename: string }>(
        "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename",
      );
      expect(rows.map((r) => r.tablename)).toEqual([
        'audit_events', 'comparisons', 'couples', 'individual_ranks', 'list_versions', 'pair_exclusions', 'pins', 'rule_exceptions',
      ]);
      const identity = await db.query<{ relname: string; relreplident: string }>(
        "select relname, relreplident from pg_class where relname = any($1) and relkind = 'r'",
        [rows.map((r) => r.tablename)],
      );
      expect(identity.every((r) => r.relreplident === 'f')).toBe(true);
    }));
});
