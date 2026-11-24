import { describe, expect, it } from 'vitest';
import { activeCouple, tx, type Db } from './db';

const IM = ['seed-mgh-internal-medicine', 'seed-jhh-internal-medicine', 'seed-ucsf-internal-medicine'];
const PEDS = ['seed-bch-pediatrics', 'seed-cnh-pediatrics'];

async function ranksOf(db: Db, coupleId: string, userId: string) {
  return db.query<{ program_id: string; rank: number; tier: string; note: string | null }>(
    'select program_id, rank, tier, note from individual_ranks where couple_id = $1 and user_id = $2 order by rank',
    [coupleId, userId],
  );
}

describe('A program list belongs to its person, not the couple (bug log #1)', () => {
  it('leaving keeps both lists; starting and joining new couples brings them back', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      await db.as(a);
      for (const [i, id] of IM.entries()) {
        await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier, note) values ($1, $2, $3, $4, $5, $6)`, [
          coupleId, a.id, id, i + 1, i === 0 ? 'A' : 'B', i === 1 ? 'great call schedule' : null,
        ]);
      }
      // A program the couple added themselves goes with that couple.
      const { id: own } = await db.one<{ id: string }>(
        `insert into programs (name, institution, specialty_code, specialty_name, match_type, match_name, city, state, source, verified, created_by_couple)
         values ('Community — IM', 'Community', 'internal-medicine', 'Internal Medicine', 'main', 'Main Residency Match', 'Quincy', 'MA', 'user', false, $1) returning id`,
        [coupleId],
      );
      await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 4, 'C')`, [coupleId, a.id, own]);
      await db.as(b);
      for (const [i, id] of PEDS.entries()) {
        await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, $4, 'B')`, [coupleId, b.id, id, i + 1]);
      }

      await db.one('select leave_couple($1)', [coupleId]);
      expect(await db.query('select from_couple from saved_rank_lists where user_id = $1', [b.id])).toEqual([{ from_couple: coupleId }]);

      // A starts a new couple: their list is already there, minus the couple's own program.
      await db.as(a);
      const { id: next } = await db.one<{ id: string }>(
        `insert into couples (partner_a, match_type, match_name, match_year) values ($1, 'main', 'Main Residency Match', 2027) returning id`,
        [a.id],
      );
      expect(await ranksOf(db, next, a.id)).toEqual([
        { program_id: IM[0], rank: 1, tier: 'A', note: null },
        { program_id: IM[1], rank: 2, tier: 'B', note: 'great call schedule' },
        { program_id: IM[2], rank: 3, tier: 'B', note: null },
      ]);

      // B joins it by invite: B's list comes along too.
      const { token } = await db.one<{ token: string }>('select token from create_invite($1, $2)', [next, b.email]);
      await db.as(b);
      await db.one('select accept_invite($1)', [token]);
      expect((await ranksOf(db, next, b.id)).map((r) => r.program_id)).toEqual(PEDS);

      // You only ever read your own saved list, and "bring back" never overwrites a list.
      expect(await db.query('select user_id from saved_rank_lists')).toEqual([{ user_id: b.id }]);
      expect(await db.one<{ n: number }>('select restore_saved_rank_list($1) as n', [next])).toEqual({ n: 0 });
    }));

  it('"Bring back my list" fills an empty list from the saved one, and only for members', () =>
    tx(async (db) => {
      const first = await activeCouple(db);
      await db.as(first.a);
      await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 1, 'A')`, [first.coupleId, first.a.id, IM[0]]);
      await db.one('select leave_couple($1)', [first.coupleId]);
      const second = await activeCouple(db);
      await db.as(second.a);
      expect(await db.one<{ n: number }>('select restore_saved_rank_list($1) as n', [second.coupleId])).toEqual({ n: 0 }); // not their saved list
      await db.as(first.a);
      await expect(db.query('select restore_saved_rank_list($1)', [second.coupleId])).rejects.toThrow(/not_allowed/);
    }));
});
