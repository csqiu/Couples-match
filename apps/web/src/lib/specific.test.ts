import { describe, expect, it } from 'vitest';
import type { ProgramSide } from './pair-view';
import { pairIdOf, pickFromPairId, rankLists, specificState } from './specific';

const side = (id: string, rank: number | null): ProgramSide => ({ id, name: id, short: id, place: '', lat: null, lon: null, tier: 'A', rank, code: '' });

describe('specific comparison helpers', () => {
  it('builds each partner’s list from the pairs, best first, without duplicates or No Match', () => {
    const [a, b] = rankLists([
      { sides: [side('x2', 2), side('y1', 1)] },
      { sides: [side('x1', 1), null] },
      { sides: [side('x2', 2), side('y3', 3)] },
      { sides: [null, side('y2', 2)] },
    ]);
    expect(a.map((s) => s.id)).toEqual(['x1', 'x2']);
    expect(b.map((s) => s.id)).toEqual(['y1', 'y2', 'y3']);
  });

  it('turns picks into pair ids and back', () => {
    expect(pairIdOf(['p', 'q'])).toBe('p|q');
    expect(pairIdOf(['p', null])).toBeNull();
    expect(pickFromPairId('p|NO_MATCH')).toEqual(['p', 'NO_MATCH']);
    expect(pickFromPairId('nonsense')).toEqual([null, null]);
    expect(pickFromPairId(undefined)).toEqual([null, null]);
  });

  it('says where the four picks stand', () => {
    expect(specificState(['p', null], [null, null])).toEqual({ kind: 'choosing', missing: 3 });
    expect(specificState(['NO_MATCH', 'NO_MATCH'], ['p', 'q'])).toEqual({ kind: 'both-no-match' });
    expect(specificState(['p', 'q'], ['p', 'q'])).toEqual({ kind: 'same' });
    expect(specificState(['p', 'q'], ['r', 'NO_MATCH'])).toEqual({ kind: 'ready', a: 'p|q', b: 'r|NO_MATCH' });
  });
});
