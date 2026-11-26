import { describe, expect, it } from 'vitest';
import { activeCouple, tx } from './db';

describe('list_versions.pair_count (bug log #30)', () => {
  it('is the number of frozen rows, kept by the database', () =>
    tx(async (db) => {
      const { a, coupleId } = await activeCouple(db);
      await db.as(a);
      const pairs = JSON.stringify([{ rank: 1 }, { rank: 2 }, { rank: 3 }]);
      const v = await db.one<{ pair_count: number }>(
        `insert into list_versions (couple_id, name, created_by, engine_version, inputs_snapshot, pairs) values ($1, 'v', $2, '0.4.0', '{}', $3) returning pair_count`,
        [coupleId, a.id, pairs],
      );
      expect(v.pair_count).toBe(3);
    }));
});
