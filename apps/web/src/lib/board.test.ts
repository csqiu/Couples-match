import { describe, expect, it } from 'vitest';
import { flatten, group, moveTo, nudge, sameOrder } from './board';
import { currentMatchYear } from './match-year';

const items = [
  { programId: 'a1', tier: 'A' as const },
  { programId: 'b1', tier: 'B' as const },
  { programId: 'b2', tier: 'B' as const },
  { programId: 'c1', tier: 'C' as const },
];

describe('board', () => {
  it('groups by tier and flattens back in rank order', () => {
    const b = group(items);
    expect(b.B.map((i) => i.programId)).toEqual(['b1', 'b2']);
    expect(flatten(b).map((i) => i.programId)).toEqual(['a1', 'b1', 'b2', 'c1']);
  });

  it('moves across tiers, updating the tier', () => {
    const b = moveTo(group(items), 'c1', 'A', 0);
    expect(flatten(b).map((i) => `${i.tier}:${i.programId}`)).toEqual(['A:c1', 'A:a1', 'B:b1', 'B:b2']);
  });

  it('nudges within a tier and across tier edges', () => {
    let b = group(items);
    b = nudge(b, 'b2', -1);
    expect(b.B.map((i) => i.programId)).toEqual(['b2', 'b1']);
    b = nudge(b, 'b2', -1); // top of B → bottom of A
    expect(b.A.map((i) => i.programId)).toEqual(['a1', 'b2']);
    b = nudge(b, 'a1', -1); // already first: no change
    expect(flatten(b)[0].programId).toBe('a1');
    b = nudge(b, 'b1', 1); // bottom of B → top of C
    expect(b.C.map((i) => i.programId)).toEqual(['b1', 'c1']);
  });

  it('detects unchanged order', () => {
    expect(sameOrder(group(items), group(items))).toBe(true);
    expect(sameOrder(group(items), nudge(group(items), 'b2', -1))).toBe(false);
  });
});

describe('match year', () => {
  it('rolls over after the March match', () => {
    expect(currentMatchYear(new Date(2026, 10, 20))).toBe(2027);
    expect(currentMatchYear(new Date(2027, 1, 1))).toBe(2027);
    expect(currentMatchYear(new Date(2027, 3, 1))).toBe(2028);
  });
});
