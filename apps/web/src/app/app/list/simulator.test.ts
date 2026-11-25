import { describe, expect, it } from 'vitest';
import { computeFinalList } from '@/lib/final-list';
import { couple, names } from '@/lib/test-fixtures';
import { allReachable, simulate } from './simulator';

describe('outcome simulator', () => {
  const list = computeFinalList(couple({ settings: { tierAPriority: 'partner1' } }), { names, matchType: 'main' });

  it('everything reachable: you match on row 1', () => {
    const { index, reach } = simulate(list.rows, allReachable(list.programs));
    expect(index).toBe(0);
    expect(reach[0]).toBe('match');
  });

  it('matches the first row with both sides reachable, and dims the rest that are out of reach', () => {
    const s = allReachable(list.programs);
    const top = list.rows[0];
    s.reach[0].delete(top.sides[0].id); // partner 1 can't get their top program
    const { index, reach } = simulate(list.rows, s);
    expect(index).toBeGreaterThan(0);
    expect(list.rows[index].sides[0].id).not.toBe(top.sides[0].id);
    list.rows.forEach((r, i) => {
      if (i === index) return;
      const ok = r.sides[0].id !== top.sides[0].id;
      expect(reach[i], `row ${i + 1}`).toBe(ok ? 'in' : 'out');
    });
    // Nothing above the match is within reach.
    expect(reach.slice(0, index).every((x) => x === 'out')).toBe(true);
  });

  it('nobody reachable: neither matches', () => {
    expect(simulate(list.rows, { reach: [new Set(), new Set()], both: new Set() }).index).toBe(-1);
  });
});
