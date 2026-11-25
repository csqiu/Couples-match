import { describe, expect, it } from 'vitest';
import { explore } from './explore';
import { A, couple, names } from './test-fixtures';

const opts = { me: A, names };

describe('comparison explorer', () => {
  const data = couple({ settings: { tierAPriority: 'partner1', listOrder: 'engine' } });

  it('lists every pair, on-list ones first by rank', () => {
    const r = explore(data, opts);
    expect(r.detail).toBeNull();
    const ranked = r.pairs.filter((p) => p.rank !== null).map((p) => p.rank);
    expect(ranked).toEqual(ranked.map((_, i) => i + 1));
  });

  it('explains the current order and previews both answers', () => {
    const { pairs } = explore(data, opts);
    const a = pairs[2];
    const b = pairs[9];
    const d = explore(data, { ...opts, a: a.id, b: b.id }).detail!;
    expect(d.higher).toBe('a');
    expect(d.why.length).toBeGreaterThan(10);
    expect(d.aOverB.asNow).toBe(true);
    expect(d.bOverA.asNow).toBe(false);
    // Keeping the order as it is moves nothing and creates no conflict.
    expect(d.aOverB.moved).toBe(0);
    expect(d.aOverB.conflicts).toEqual([]);
    // Flipping it moves at least the two pairs, or is blocked by something it would contradict.
    expect(d.bOverA.moved > 0 || d.bOverA.conflicts.length > 0).toBe(true);
    if (d.fixed) expect(d.bOverA.conflicts.length).toBeGreaterThan(0);
  });

  it('shows an existing answer', () => {
    const { pairs } = explore(data, opts);
    // Two pairs only the score orders, so an answer can flip them.
    let a = pairs[0];
    let b = pairs[1];
    search: for (let i = 0; i < 12; i++) {
      for (let j = i + 1; j < 12; j++) {
        if (!explore(data, { ...opts, a: pairs[i].id, b: pairs[j].id }).detail!.fixed) {
          [a, b] = [pairs[i], pairs[j]];
          break search;
        }
      }
    }
    const answered = { ...data, comparisons: [{ id: 'x', pair_left: b.id, pair_right: a.id, winner: 'left' as const, answered_by: A, both_agreed: true, locked: false, seq: 1 }] };
    const d = explore(answered, { ...opts, a: a.id, b: b.id }).detail!;
    expect(d.answer).toEqual({ winner: 'b', locked: false });
    expect(d.higher).toBe('b');
    expect(d.fixed).toBe(true);
  });
});
