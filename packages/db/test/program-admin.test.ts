import { describe, expect, it } from 'vitest';
import { activeCouple, tx, type Db } from './db';

const MGH = 'seed-mgh-internal-medicine';
const JHH = 'seed-jhh-internal-medicine';
const BCH = 'seed-bch-pediatrics';
const CNH = 'seed-cnh-pediatrics';

/** A user-added copy of MGH Internal Medicine, at the same spot. */
async function addDuplicate(db: Db, coupleId: string) {
  const { id } = await db.one<{ id: string }>(
    `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, city, state, address,
                           lat, lon, geocode_confidence, geocode_source, source, verified, created_by_couple)
     select 'MGH IM (typed by us)', institution, specialty_code, specialty_name, match_type, match_name, city, state, address,
            lat + 0.001, lon, 0.95, 'census', 'user', false, $1
     from programs where id = $2
     returning id`,
    [coupleId, MGH],
  );
  return id;
}

describe('Program admin', () => {
  it('merging a duplicate moves ranks, answers, pins and exclusions to the real program', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await db.as(a);
      const dup = await addDuplicate(db, coupleId);
      for (const [i, id] of [dup, JHH, MGH].entries()) {
        await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier, nrmp_code) values ($1, $2, $3, $4, 'A', $5)`, [
          coupleId, a.id, id, i + 1, id === dup ? '1234140C0' : null,
        ]);
      }
      await db.as(b);
      for (const [i, id] of [BCH, CNH].entries()) {
        await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, $4, 'B')`, [coupleId, b.id, id, i + 1]);
      }
      await db.as(a);
      // Becomes "MGH vs MGH" after the merge → dropped.
      await db.query(`insert into comparisons (couple_id, pair_left, pair_right, winner, answered_by) values ($1, $2, $3, 'left', $4)`, [
        coupleId, `${dup}|${BCH}`, `${MGH}|${BCH}`, a.id,
      ]);
      const { id: kept } = await db.one<{ id: string }>(
        `insert into comparisons (couple_id, pair_left, pair_right, winner, answered_by, locked) values ($1, $2, $3, 'left', $4, true) returning id`,
        [coupleId, `${dup}|${BCH}`, `${JHH}|${CNH}`, a.id],
      );
      await db.query(`insert into pins (couple_id, higher_pair, lower_pair, source, comparison_id, created_by) values ($1, $2, $3, 'comparison', $4, $5)`, [
        coupleId, `${dup}|${BCH}`, `${JHH}|${CNH}`, kept, a.id,
      ]);
      await db.query(`insert into pair_exclusions (couple_id, program_a, program_b, created_by) values ($1, $2, $3, $4)`, [coupleId, dup, CNH, a.id]);
      await db.query(`insert into rule_exceptions (couple_id, higher_pair, lower_pair, created_by) values ($1, $2, $3, $4)`, [
        coupleId, `${JHH}|${BCH}`, `${dup}|NO_MATCH`, a.id,
      ]);

      // Couples can't merge, and can't see the duplicate list.
      expect(await db.error('select merge_programs($1, $2)', [dup, MGH])).toMatch(/not_admin/);
      expect(await db.error('select * from program_duplicates()')).toMatch(/not_admin/);

      const admin = await db.createUser(`admin-${Math.random().toString(36).slice(2)}@example.com`, { admin: true });
      await db.as(admin);
      const dups = await db.query<{ program_a: string; program_b: string; distance_mi: number }>('select * from program_duplicates()');
      const found = dups.find((d) => [d.program_a, d.program_b].sort().join() === [dup, MGH].sort().join());
      expect(found?.distance_mi).toBeLessThan(0.1);

      await db.query('select merge_programs($1, $2)', [dup, MGH]);

      await db.as(a);
      const ranks = await db.query<{ program_id: string; rank: number; nrmp_code: string | null }>(
        'select program_id, rank, nrmp_code from individual_ranks where user_id = $1 order by rank',
        [a.id],
      );
      // The better rank (#1) is kept, its NRMP code carried over, and the gap closed.
      expect(ranks).toEqual([
        { program_id: MGH, rank: 1, nrmp_code: '1234140C0' },
        { program_id: JHH, rank: 2, nrmp_code: null },
      ]);
      expect(await db.query('select pair_left, pair_right, locked from comparisons where couple_id = $1', [coupleId])).toEqual([
        { pair_left: `${MGH}|${BCH}`, pair_right: `${JHH}|${CNH}`, locked: true },
      ]);
      expect(await db.query('select higher_pair, lower_pair from pins where couple_id = $1', [coupleId])).toEqual([
        { higher_pair: `${MGH}|${BCH}`, lower_pair: `${JHH}|${CNH}` },
      ]);
      expect(await db.query('select program_a, program_b from pair_exclusions where couple_id = $1', [coupleId])).toEqual([
        { program_a: MGH, program_b: CNH },
      ]);
      expect(await db.query('select lower_pair from rule_exceptions where couple_id = $1', [coupleId])).toEqual([{ lower_pair: `${MGH}|NO_MATCH` }]);
      expect(await db.query('select 1 from programs where id = $1', [dup])).toHaveLength(0);
    }));

  it('refuses merges across matches or into another couple’s private program', () =>
    tx(async (db) => {
      const one = await activeCouple(db);
      const two = await activeCouple(db, { year: 2028 });
      await db.as(one.a);
      const dupOne = await addDuplicate(db, one.coupleId);
      await db.as(two.a);
      const dupTwo = await addDuplicate(db, two.coupleId);
      const admin = await db.createUser(`admin-${Math.random().toString(36).slice(2)}@example.com`, { admin: true });
      await db.as(admin);
      expect(await db.error('select merge_programs($1, $2)', [dupOne, dupTwo])).toMatch(/program_not_available/);
      expect(await db.error('select merge_programs($1, $2)', [MGH, MGH])).toMatch(/same_program/);
      expect(await db.error('select merge_programs($1, $2)', ['nope', MGH])).toMatch(/program_not_found/);
      const fellowship = await db.one<{ id: string } | undefined>(
        "select id from programs where match_type <> 'main' and id not like 'NO_MATCH%' limit 1",
      ).catch(() => undefined);
      if (fellowship) expect(await db.error('select merge_programs($1, $2)', [fellowship.id, MGH])).toMatch(/program_wrong_match/);
    }));

  it('admins import global programs by id; couples can only add private, unverified ones', () =>
    tx(async (db) => {
      const { a, coupleId } = await activeCouple(db);
      const program = (id: string, extra: Record<string, unknown> = {}) => ({
        id, name: 'Test IM', institution: 'Test Hospital', specialtyCode: 'internal-medicine', specialtyName: 'Internal Medicine',
        matchType: 'main', matchName: 'Main Residency Match', acgmeId: id.replace('acgme-', ''), city: 'Boston', state: 'MA',
        address: '1 Main St, Boston, MA', lat: 42.36, lon: -71.06, geocodeConfidence: 0.95, geocodeSource: 'census',
        isAdvanced: false, source: 'test-import', verified: true, ...extra,
      });
      await db.as(a);
      expect(await db.error('select * from import_programs($1)', [JSON.stringify([program('acgme-1')])])).toMatch(/not_admin/);
      expect(
        await db.error(
          `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, source, verified)
           values ('X', 'X', 'internal-medicine', 'Internal Medicine', 'main', 'Main Residency Match', 'acgme', true)`,
        ),
      ).toMatch(/row-level security/);
      expect(
        await db.error(
          `insert into programs (id, name, institution, specialty_code, specialty_name, match_type, match_name, source, verified, created_by_couple)
           values ('acgme-9', 'X', 'X', 'internal-medicine', 'Internal Medicine', 'main', 'Main Residency Match', 'user', false, $1)`,
          [coupleId],
        ),
      ).toMatch(/permission denied/); // couples can't choose an id

      const admin = await db.createUser(`admin-${Math.random().toString(36).slice(2)}@example.com`, { admin: true });
      await db.as(admin);
      expect(await db.one('select * from import_programs($1)', [JSON.stringify([program('acgme-1'), program('acgme-2')])])).toEqual({ inserted: 2, updated: 0 });
      // An admin fixes acgme-1's location by hand; a re-import updates the name but keeps that location.
      await db.query("update programs set lat = 42.5, lon = -71.1, geocode_source = 'manual' where id = 'acgme-1'");
      expect(
        await db.one('select * from import_programs($1)', [JSON.stringify([program('acgme-1', { name: 'Renamed IM' }), program('acgme-3')])]),
      ).toEqual({ inserted: 1, updated: 1 });
      expect(await db.one("select name, lat, geocode_source from programs where id = 'acgme-1'")).toEqual({ name: 'Renamed IM', lat: 42.5, geocode_source: 'manual' });
      // Never overwrites a couple's private program or creates "user-" ids.
      await db.as(a);
      const dup = await addDuplicate(db, coupleId);
      await db.as(admin);
      expect(await db.error('select * from import_programs($1)', [JSON.stringify([program(dup)])])).toMatch(/bad_input/);
      await db.as(a);
      expect(await db.query("select id from programs where id like 'acgme-%' order by id")).toEqual([{ id: 'acgme-1' }, { id: 'acgme-2' }, { id: 'acgme-3' }]);
    }));
});
