import { SEED_PROGRAMS } from '@pairwise/data';
import type { CoupleData } from '@pairwise/db';
import { describe, expect, it } from 'vitest';
import { analyze } from './analysis';

const A = 'user-a';
const B = 'user-b';
const names: [string, string] = ['Alex', 'Sam'];

function couple(opts: { aList?: Array<[string, 'A' | 'B' | 'C']>; bList?: Array<[string, 'A' | 'B' | 'C']>; settings?: object } = {}): CoupleData {
  const aList = opts.aList ?? [['seed-mgh-internal-medicine', 'A'], ['seed-jhh-internal-medicine', 'B'], ['seed-ucsf-internal-medicine', 'B'], ['seed-nm-internal-medicine', 'C']];
  const bList = opts.bList ?? [['seed-bch-pediatrics', 'A'], ['seed-cnh-pediatrics', 'B'], ['seed-ucsfbch-pediatrics', 'B'], ['seed-lurie-pediatrics', 'C']];
  const ids = [...aList, ...bList].map(([id]) => id);
  return {
    couple: { id: 'c1', partner_a: A, partner_b: B, match_type: 'main', settings: (opts.settings ?? {}) as never },
    programs: SEED_PROGRAMS.filter((p) => ids.includes(p.id)).map((p) => ({
      id: p.id, name: p.name, institution: p.institution, city: p.city, state: p.state, lat: p.lat, lon: p.lon,
      cbsa_code: p.cbsaCode, nrmp_code: null, is_advanced: false,
    })),
    ranks: [
      ...aList.map(([program_id, tier], i) => ({ user_id: A, program_id, rank: i + 1, tier, acceptable: true, note: null, nrmp_code: null })),
      ...bList.map(([program_id, tier], i) => ({ user_id: B, program_id, rank: i + 1, tier, acceptable: true, note: null, nrmp_code: null })),
    ],
    comparisons: [],
    pins: [],
    exclusions: [],
    exceptions: [],
  };
}

const opts = (me = A, answerMode: 'together' | 'separately' = 'together') => ({ me, names, answerMode });

describe('analyze', () => {
  it('waits for the partner’s list before asking anything', () => {
    const r = analyze(couple({ bList: [] }), opts());
    expect(r.hasBothLists).toBe(false);
    expect(r.question).toBeNull();
  });

  it('opens with a calibration question about two real pairs', () => {
    const r = analyze(couple({ settings: { tierAPriority: 'case_by_case' } }), opts());
    expect(r.question?.kind).toBe('calibration');
    const { left, right } = r.question!;
    expect(left.id).not.toBe(right.id);
    for (const pair of [left, right]) {
      expect(pair.sides[0]?.name).toMatch(/Internal Medicine/);
      expect(pair.sides[1]?.name).toMatch(/Pediatrics/);
      expect(pair.bandLabel).toBeTruthy();
    }
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('asks Tier A priority once when both partners have Tier A programs', () => {
    const r = analyze(couple(), opts());
    const collision = r.conflicts.filter((c) => c.kind === 'tier_a_collision');
    expect(collision).toHaveLength(1);
    expect(collision[0].text).toMatch(/Alex, Sam, or decide case by case/);
    expect(collision[0].left && collision[0].right).toBeTruthy();
    expect(analyze(couple({ settings: { tierAPriority: 'partner1' } }), opts()).conflicts).toHaveLength(0);
  });

  it('separate answering: I get my partner’s pending question, and different answers become a disagreement', () => {
    const data = couple({ settings: { tierAPriority: 'case_by_case', answerMode: 'separately' } });
    const first = analyze(data, opts(A, 'separately')).question!;
    data.comparisons.push({ id: 'x1', pair_left: first.left.id, pair_right: first.right.id, winner: 'left', answered_by: A, both_agreed: false, locked: false, seq: 1 });

    const forSam = analyze(data, opts(B, 'separately')).question!;
    expect(forSam.kind).toBe('partner');
    expect([forSam.left.id, forSam.right.id]).toEqual([first.left.id, first.right.id]);
    expect(forSam.partnerAnswer).toBe('left');

    data.comparisons.push({ id: 'x2', pair_left: first.left.id, pair_right: first.right.id, winner: 'right', answered_by: B, both_agreed: false, locked: false, seq: 2 });
    const r = analyze(data, opts(B, 'separately'));
    const d = r.conflicts.find((c) => c.kind === 'disagreement')!;
    expect(d.answers).toEqual(expect.arrayContaining([{ by: 'partner', winner: 'left' }, { by: 'me', winner: 'right' }]));
    expect(r.question?.kind).not.toBe('partner');
  });

  it('explains a cycle as readable links that can be broken', () => {
    const data = couple({
      aList: [['seed-mgh-internal-medicine', 'B'], ['seed-bidmc-internal-medicine', 'B'], ['seed-bwh-internal-medicine', 'B']],
      bList: [['seed-bch-pediatrics', 'B'], ['seed-bmc-pediatrics', 'B']],
    });
    const p = (a: string, b: string) => `seed-${a}-internal-medicine|seed-${b}-pediatrics`;
    // mgh|bmc > bidmc|bch > bwh|... form a loop with a pin back.
    data.pins = [
      { id: 'p1', higher_pair: p('mgh', 'bmc'), lower_pair: p('bidmc', 'bch'), source: 'manual_drag', comparison_id: null },
      { id: 'p2', higher_pair: p('bidmc', 'bch'), lower_pair: p('mgh', 'bmc'), source: 'manual_drag', comparison_id: null },
    ];
    const cycle = analyze(data, opts()).conflicts.find((c) => c.kind === 'cycle')!;
    expect(cycle.links).toHaveLength(2);
    for (const l of cycle.links!) expect(l.text).toMatch(/is over .* because you dragged it there/);
  });
});
