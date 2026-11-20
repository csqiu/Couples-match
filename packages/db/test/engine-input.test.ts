import { describe, expect, it } from 'vitest';
import { NO_MATCH, runEngine } from '@pairwise/engine';
import { buildEngineInput, coupleSeed, settingsFrom, toEngineProgramId, type CoupleData } from '../src/index';
import { activeCouple, tx } from './db';

describe('Database rows → engine input', () => {
  it('a member loads the couple through RLS and gets a ranked list', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      const imIds = ['seed-mgh-internal-medicine', 'seed-jhh-internal-medicine', 'seed-ucsf-internal-medicine'];
      const pedsIds = ['seed-bch-pediatrics', 'seed-cnh-pediatrics', 'seed-ucsfbch-pediatrics'];
      for (const [user, ids] of [[a, imIds], [b, pedsIds]] as const) {
        await db.as(user);
        for (const [i, id] of ids.entries()) {
          await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, $4, $5)`, [
            coupleId, user.id, id, i + 1, i === 0 ? 'A' : 'B',
          ]);
        }
      }
      await db.query(`update couples set settings = '{"privacy": "private_tiers", "balance": 1.2}' where id = $1`, [coupleId]);
      await db.query(`insert into pair_exclusions (couple_id, program_a, program_b, created_by) values ($1, 'NO_MATCH-main', $2, $3)`, [
        coupleId, 'seed-ucsfbch-pediatrics', b.id,
      ]);

      // What the app would load, as partner B.
      const couple = await db.one<CoupleData['couple']>('select id, partner_a, partner_b, match_type, settings from couples where id = $1', [coupleId]);
      const ranks = await db.query<CoupleData['ranks'][number]>(
        'select user_id, program_id, rank, tier, acceptable, note, nrmp_code from individual_ranks where couple_id = $1',
        [coupleId],
      );
      const programs = await db.query<CoupleData['programs'][number]>(
        'select id, name, institution, city, state, lat, lon, cbsa_code, nrmp_code, is_advanced from programs where id = any($1)',
        [ranks.map((r) => r.program_id)],
      );
      const exclusions = await db.query<CoupleData['exclusions'][number]>(
        'select program_a, program_b, reason from pair_exclusions where couple_id = $1',
        [coupleId],
      );
      const input = buildEngineInput({ couple, programs, ranks, comparisons: [], pins: [], exclusions, exceptions: [] });

      expect(input.lists[0].map((e) => e.programId)).toEqual(imIds);
      expect(input.lists[1].map((e) => e.programId)).toEqual(pedsIds);
      expect(input.settings.balance).toBe(1.2);
      expect(input.settings.matchType).toBe('main');
      expect(input.exclusions).toEqual([{ programA: NO_MATCH, programB: 'seed-ucsfbch-pediatrics' }]);
      expect(input.seed).toBe(coupleSeed(coupleId));

      const { list, pairs } = runEngine(input);
      expect(pairs).toHaveLength(4 * 4 - 1 - 1); // minus (NM, NM) and the exclusion
      expect(list.rows[0].pair.id).toBe('seed-mgh-internal-medicine|seed-bch-pediatrics');
    }));
});

describe('helpers', () => {
  it('maps No Match sentinel rows and strips app-only settings', () => {
    expect(toEngineProgramId('NO_MATCH-main')).toBe(NO_MATCH);
    expect(toEngineProgramId('NO_MATCH-sms_fellowship')).toBe(NO_MATCH);
    expect(toEngineProgramId('seed-mgh-internal-medicine')).toBe('seed-mgh-internal-medicine');
    const s = settingsFrom({ match_type: 'sms_fellowship', settings: { privacy: 'private_tiers', listLength: 120 } });
    expect(s).toMatchObject({ matchType: 'sms_fellowship', listLength: 120 });
    expect('privacy' in s).toBe(false);
  });
});
