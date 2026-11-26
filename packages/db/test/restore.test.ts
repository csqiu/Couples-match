import { describe, expect, it } from 'vitest';
import { buildEngineInput, type CoupleData } from '../src/index';
import { activeCouple, tx, type Db } from './db';

const IM = ['seed-mgh-internal-medicine', 'seed-jhh-internal-medicine'];
const PEDS = ['seed-bch-pediatrics', 'seed-cnh-pediatrics'];
const NEW = 'seed-ucsf-internal-medicine';

/** What the app stores as a version's inputs_snapshot: the engine input built from the couple's rows. */
async function snapshot(db: Db, coupleId: string) {
  const couple = await db.one<CoupleData['couple']>('select id, partner_a, partner_b, match_type, settings from couples where id = $1', [coupleId]);
  const ranks = await db.query<CoupleData['ranks'][number]>('select user_id, program_id, rank, tier, acceptable, note, nrmp_code from individual_ranks where couple_id = $1', [coupleId]);
  const programs = await db.query<CoupleData['programs'][number]>(
    'select id, name, institution, city, state, lat, lon, cbsa_code, nrmp_code, is_advanced from programs where id = any($1)',
    [ranks.map((r) => r.program_id)],
  );
  const comparisons = await db.query<CoupleData['comparisons'][number]>('select id, pair_left, pair_right, winner, answered_by, both_agreed, locked, seq from comparisons where couple_id = $1', [coupleId]);
  const pins = await db.query<CoupleData['pins'][number]>('select id, higher_pair, lower_pair, source, comparison_id, moved_pair from pins where couple_id = $1 order by created_at, id', [coupleId]);
  return buildEngineInput({ couple, programs, ranks, comparisons, pins, exclusions: [], exceptions: [] });
}

describe('Restoring a version', () => {
  it('brings back answers, pins, settings and tiers on today’s programs; holds back newer ones; keeps privacy', () =>
    tx(async (db) => {
      const { a, b, coupleId } = await activeCouple(db);
      for (const [user, ids] of [[a, IM], [b, PEDS]] as const) {
        await db.as(user);
        for (const [i, id] of ids.entries()) {
          await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier, nrmp_code) values ($1, $2, $3, $4, 'A', $5)`, [
            coupleId, user.id, id, i + 1, i === 0 ? '1234140C0' : null,
          ]);
        }
      }
      await db.as(a);
      const left = `${IM[0]}|${PEDS[0]}`;
      const right = `${IM[1]}|${PEDS[1]}`;
      const { id: cmp } = await db.one<{ id: string }>(
        `insert into comparisons (couple_id, pair_left, pair_right, winner, answered_by, both_agreed, locked) values ($1, $2, $3, 'left', $4, true, true) returning id`,
        [coupleId, left, right, a.id],
      );
      await db.query(`insert into pins (couple_id, higher_pair, lower_pair, source, comparison_id, created_by) values ($1, $2, $3, 'comparison', $4, $5)`, [coupleId, left, right, cmp, a.id]);
      // Two drags, made in this order: the second one dragged down.
      await db.query(`insert into pins (couple_id, higher_pair, lower_pair, source, created_by, moved_pair, created_at) values ($1, $2, $3, 'manual_drag', $4, 'higher', now() + interval '1 second')`, [coupleId, right, `${IM[0]}|${PEDS[1]}`, a.id]);
      await db.query(`insert into pins (couple_id, higher_pair, lower_pair, source, created_by, moved_pair, created_at) values ($1, $2, $3, 'manual_drag', $4, 'lower', now() + interval '2 second')`, [coupleId, left, `${IM[1]}|${PEDS[0]}`, a.id]);
      await db.query(`update couples set settings = '{"balance": 1.3, "privacy": "shared"}' where id = $1`, [coupleId]);

      const snap = await snapshot(db, coupleId);
      const { id: version } = await db.one<{ id: string }>(
        `insert into list_versions (couple_id, name, created_by, engine_version, inputs_snapshot, pairs) values ($1, 'v1', $2, '0.2.0', $3, '[]') returning id`,
        [coupleId, a.id, JSON.stringify(snap)],
      );

      // Both partners change things afterwards.
      await db.query('delete from comparisons where couple_id = $1', [coupleId]);
      await db.query(`update couples set settings = '{"balance": 0.7, "privacy": "private_tiers"}' where id = $1`, [coupleId]);
      await db.query(`update individual_ranks set tier = 'C' where user_id = $1`, [a.id]);
      // A adds a program the version didn't have.
      await db.query(`insert into individual_ranks (couple_id, user_id, program_id, rank, tier) values ($1, $2, $3, 3, 'A')`, [coupleId, a.id, NEW]);
      await db.as(b);
      await db.query('delete from individual_ranks where user_id = $1 and program_id = $2', [b.id, PEDS[1]]);

      // Partner B restores — rewriting A's list too, which RLS alone wouldn't allow.
      await db.query('select restore_version($1)', [version]);
      const ranks = await db.query<{ user_id: string; program_id: string; tier: string; nrmp_code: string | null }>(
        'select user_id, program_id, tier, nrmp_code from individual_ranks where couple_id = $1 order by user_id = $2 desc, rank',
        [coupleId, a.id],
      );
      // Today's programs (bug log #35): the version's tiers and order, B's removed program stays
      // removed, and A's new one goes to Tier B at the end.
      expect(ranks.map((r) => `${r.user_id === a.id ? 'a' : 'b'}:${r.program_id}:${r.tier}`)).toEqual([
        ...IM.map((id) => `a:${id}:A`),
        `a:${NEW}:B`,
        `b:${PEDS[0]}:A`,
      ]);
      expect(ranks[0].nrmp_code).toBe('1234140C0');
      expect(await db.query('select id, locked from comparisons where couple_id = $1', [coupleId])).toEqual([{ id: cmp, locked: true }]);
      expect(await db.query('select comparison_id, moved_pair from pins where couple_id = $1 order by created_at', [coupleId])).toEqual([
        { comparison_id: cmp, moved_pair: null },
        { comparison_id: null, moved_pair: 'higher' },
        { comparison_id: null, moved_pair: 'lower' },
      ]);
      const { settings } = await db.one<{ settings: Record<string, unknown> }>('select settings from couples where id = $1', [coupleId]);
      expect(settings.balance).toBe(1.3);
      expect(settings.privacy).toBe('private_tiers'); // app-only setting untouched
      // Pairs with the new program wait off the final list.
      expect(settings.heldPrograms).toEqual([[NEW], []]);
      expect(await db.query('select 1 from list_versions where couple_id = $1', [coupleId])).toHaveLength(1);
      expect(await db.query("select 1 from audit_events where couple_id = $1 and type = 'list_versions.restored'", [coupleId])).toHaveLength(1);
    }));

  it('only members of a couple that hasn’t split up can restore', () =>
    tx(async (db) => {
      const { a, coupleId } = await activeCouple(db);
      await db.as(a);
      const { id: version } = await db.one<{ id: string }>(
        `insert into list_versions (couple_id, name, created_by, engine_version, inputs_snapshot, pairs) values ($1, 'v1', $2, '0.2.0', '{}', '[]') returning id`,
        [coupleId, a.id],
      );
      const eve = await db.createUser('eve@example.com');
      await db.as(eve);
      expect(await db.error('select restore_version($1)', [version])).toMatch(/not_allowed/);
      await db.as(a);
      await db.query('select leave_couple($1)', [coupleId]);
      expect(await db.error('select restore_version($1)', [version])).toMatch(/not_allowed/);
    }));
});
