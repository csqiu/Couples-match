import { describe, expect, it } from 'vitest';
import { analyze } from './analysis';

import { A, B, couple, names } from './test-fixtures';

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

  it('never asks who gets Tier A priority: clashing tier rules are left to this or that', () => {
    const r = analyze(couple(), opts());
    expect(r.conflicts).toHaveLength(0);
    expect(r.question).not.toBeNull();
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

  it('come back to this later: a deferred question waits until nothing else is left, then returns', () => {
    const base = { tierAPriority: 'case_by_case' as const };
    const first = analyze(couple({ settings: base }), opts()).question!;
    const key = [first.left.id, first.right.id].sort().join('#');
    const later = analyze(couple({ settings: { ...base, deferredQuestions: [key] } }), opts());
    expect(later.deferred).toBe(1);
    const next = later.question!;
    expect([next.left.id, next.right.id].sort().join('#')).not.toBe(key);
  });

  it('flagged questions are listed with where they stand, and the question shows its flag', () => {
    const base = { tierAPriority: 'case_by_case' as const };
    const q = analyze(couple({ settings: base }), opts()).question!;
    const key = [q.left.id, q.right.id].sort().join('#');
    const r = analyze(couple({ settings: { ...base, flaggedQuestions: [key] } }), opts());
    expect(r.flagged).toHaveLength(1);
    expect(r.flagged[0].answer).toBeNull();
    expect(r.question?.flagged).toBe(true);
  });
});

