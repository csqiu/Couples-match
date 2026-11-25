import { describe, expect, it } from 'vitest';
import { activeCouple, tx, type Db } from './db';

const IM = ['seed-mgh-internal-medicine', 'seed-jhh-internal-medicine', 'seed-ucsf-internal-medicine'];
const PEDS = ['seed-bch-pediatrics', 'seed-cnh-pediatrics'];

async function ranksOf(db: Db, coupleId: string, userId: string) {
  return db.query<{ program_id: string; rank: number; tier: string }>(
    'select program_id, rank, tier from individual_ranks where couple_id = $1 and user_id = $2 order by rank',
    [coupleId, userId],
  );
}

async function saveVersion(db: Db, coupleId: string, userId: string, name: string, snapshot: unknown = {}) {
  return db.one<{ id: string; minor: number; list_id: string }>(
    `insert into list_versions (couple_id, name, created_by, engine_version, inputs_snapshot, pairs)
     values ($1, $2, $3, '0.4.0', $4, '[]') returning id, minor, list_id`,
    [coupleId, name, userId, JSON.stringify(snapshot)],
  );
}

/** A couple with A's three IM programs (tiers A, B, C) and B's two Peds programs, and one answer. */
async function setUp(db: Db) {
  const c = await activeCouple(db);
  await db.as(c.a);
  for (const [i, id] of IM.entries()) {
    await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier, note) values ($1, $2, $3, $4, $5, $6)`, [
      c.coupleId, c.a.id, id, i + 1, ['A', 'B', 'C'][i], i === 0 ? 'loved it' : null,
    ]);
  }
  await db.as(c.b);
  for (const [i, id] of PEDS.entries()) {
    await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, $4, 'A')`, [c.coupleId, c.b.id, id, i + 1]);
  }
  await db.query(
    `insert into comparisons (couple_id, pair_left, pair_right, winner, answered_by) values ($1, $2, $3, 'left', $4)`,
    [c.coupleId, `${IM[0]}|${PEDS[0]}`, `${IM[1]}|${PEDS[1]}`, c.b.id],
  );
  await db.query(`update couples set settings = '{"listLength": 40, "balance": 1.2}' where id = $1`, [c.coupleId]);
  return c;
}

describe('Lists and numbered versions', () => {
  it('a couple starts with List 1 open; versions are numbered within it and can be starred', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await setUp(db);
      await db.as(a);
      const lists = await db.query<{ id: string; number: number }>('select id, number from rank_lists where couple_id = $1', [coupleId]);
      expect(lists.map((l) => l.number)).toEqual([1]);
      expect(await db.one('select active_list from couples where id = $1', [coupleId])).toEqual({ active_list: lists[0].id });

      const v1 = await saveVersion(db, coupleId, a.id, 'First');
      const v2 = await saveVersion(db, coupleId, a.id, 'Second');
      expect([v1.minor, v2.minor]).toEqual([1, 2]);
      expect(v1.list_id).toBe(lists[0].id);

      // Stars, names and notes change; the content and numbers don't.
      await db.as(b);
      await db.query('update list_versions set starred = true where id = $1', [v1.id]);
      expect(await db.one('select starred from list_versions where id = $1', [v1.id])).toEqual({ starred: true });
      expect(await db.error('update list_versions set minor = 7 where id = $1', [v1.id])).toMatch(/version_is_frozen|permission denied/);
    }));

  it('starting a new list keeps the programs, clears the answers and list settings, and numbers from 1 again', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await setUp(db);
      await db.as(a);
      await saveVersion(db, coupleId, a.id, '1.1');
      const { start_list: second } = await db.one<{ start_list: string }>("select start_list('After interviews')");

      const list = await db.one<{ number: number; name: string }>('select number, name from rank_lists where id = $1', [second]);
      expect(list).toEqual({ number: 2, name: 'After interviews' });
      expect(await db.one('select active_list from couples where id = $1', [coupleId])).toEqual({ active_list: second });
      // Blank tiers: everything in Tier B, in today's order. Notes stay.
      expect(await ranksOf(db, coupleId, a.id)).toEqual(IM.map((id, i) => ({ program_id: id, rank: i + 1, tier: 'B' })));
      expect(await db.one('select note from individual_ranks where couple_id = $1 and program_id = $2', [coupleId, IM[0]])).toEqual({ note: 'loved it' });
      expect(await db.query('select id from comparisons where couple_id = $1', [coupleId])).toEqual([]);
      // List settings go; couple settings stay.
      expect(await db.one('select settings from couples where id = $1', [coupleId])).toEqual({ settings: { balance: 1.2 } });

      await db.as(b);
      const v = await saveVersion(db, coupleId, b.id, '2.1');
      expect(v).toMatchObject({ list_id: second, minor: 1 });

      // The activity feed gets one line, not a delete and re-add of every row.
      const types = await db.query<{ type: string }>("select type from audit_events where couple_id = $1 and created_at = now() order by id", [coupleId]);
      expect(types.map((t) => t.type)).toContain('rank_lists.started');
      expect(types.map((t) => t.type)).not.toContain('individual_ranks.delete');
    }));

  it('opening a list brings back its tiers, answers and settings, with programs added since in Tier B', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await setUp(db);
      await db.as(a);
      const { id: first } = await db.one<{ id: string }>('select id from rank_lists where couple_id = $1', [coupleId]);
      await db.one('select start_list()');
      // In List 2, A puts the last program first and adds a new one; B removes one.
      await db.query(`update individual_ranks set tier = 'A' where couple_id = $1 and program_id = $2`, [coupleId, IM[2]]);
      await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, 'seed-bidmc-internal-medicine', 4, 'C')`, [coupleId, a.id]);
      await db.as(b);
      await db.query('delete from individual_ranks where couple_id = $1 and program_id = $2', [coupleId, PEDS[1]]);

      await db.one('select open_list($1)', [first]);
      expect(await db.one('select active_list from couples where id = $1', [coupleId])).toEqual({ active_list: first });
      expect(await ranksOf(db, coupleId, a.id)).toEqual([
        { program_id: IM[0], rank: 1, tier: 'A' },
        { program_id: IM[1], rank: 2, tier: 'B' },
        { program_id: 'seed-bidmc-internal-medicine', rank: 3, tier: 'B' },
        { program_id: IM[2], rank: 4, tier: 'C' },
      ]);
      expect((await ranksOf(db, coupleId, b.id)).map((r) => r.program_id)).toEqual([PEDS[0]]);
      expect(await db.query('select winner from comparisons where couple_id = $1', [coupleId])).toEqual([{ winner: 'left' }]);
      expect(await db.one('select settings from couples where id = $1', [coupleId])).toEqual({ settings: { balance: 1.2, listLength: 40 } });
      expect(await db.one('select draft from rank_lists where id = $1', [first])).toEqual({ draft: null });
    }));

  it('a new list can take its tiers from a saved version', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await setUp(db);
      await db.as(a);
      const snapshot = {
        lists: [
          [{ programId: IM[2], rank: 1, tier: 'A' }, { programId: IM[0], rank: 2, tier: 'C' }],
          [{ programId: PEDS[1], rank: 1, tier: 'A' }, { programId: PEDS[0], rank: 2, tier: 'B' }],
        ],
      };
      const v = await saveVersion(db, coupleId, a.id, 'Snap', snapshot);
      await db.one('select start_list(null, $1)', [v.id]);
      expect(await ranksOf(db, coupleId, a.id)).toEqual([
        { program_id: IM[2], rank: 1, tier: 'A' },
        { program_id: IM[1], rank: 2, tier: 'B' }, // not in the version: Tier B
        { program_id: IM[0], rank: 3, tier: 'C' },
      ]);
      expect(await ranksOf(db, coupleId, b.id)).toEqual([
        { program_id: PEDS[1], rank: 1, tier: 'A' },
        { program_id: PEDS[0], rank: 2, tier: 'B' },
      ]);
    }));

  it('only members can open lists, and a version restores only inside its own list', () =>
    tx(async (db) => {
      const { a, coupleId } = await setUp(db);
      const other = await activeCouple(db);
      await db.as(a);
      const v = await saveVersion(db, coupleId, a.id, '1.1');
      const { id: first } = await db.one<{ id: string }>('select id from rank_lists where couple_id = $1', [coupleId]);
      await db.one('select start_list()');
      expect(await db.error('select restore_version($1)', [v.id])).toMatch(/version_in_other_list/);
      await db.as(other.a);
      expect(await db.error('select open_list($1)', [first])).toMatch(/not_allowed/);
      expect(await db.query('select id from rank_lists where couple_id = $1', [coupleId])).toEqual([]);
      expect(await db.error('select start_list(null, $1)', [v.id])).toMatch(/not_allowed/);
    }));
});
