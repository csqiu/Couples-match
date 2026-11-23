import { describe, expect, it } from 'vitest';
import { diffSummary, diffVersions, type VersionRow } from './versions';

const row = (rank: number, pairId: string): VersionRow => ({
  rank,
  pairId,
  a: { id: pairId.split('|')[0], name: pairId.split('|')[0], code: '' },
  b: { id: pairId.split('|')[1], name: pairId.split('|')[1], code: '' },
  distanceMi: 1,
  band: 'together',
  bandLabel: 'Together',
});

describe('diffVersions', () => {
  it('marks moved, added and removed rows', () => {
    const older = [row(1, 'a|x'), row(2, 'b|x'), row(3, 'c|x')];
    const newer = [row(1, 'b|x'), row(2, 'a|x'), row(3, 'd|x')];
    const d = diffVersions(older, newer);
    expect(d.map((r) => [r.pairId, r.kind, r.before, r.after])).toEqual([
      ['b|x', 'up', 2, 1],
      ['a|x', 'down', 1, 2],
      ['d|x', 'added', null, 3],
      ['c|x', 'removed', 3, null],
    ]);
    expect(diffSummary(d)).toEqual({ moved: 2, added: 1, removed: 1, same: 0 });
  });

  it('identical versions have no changes', () => {
    const v = [row(1, 'a|x'), row(2, 'b|x')];
    expect(diffSummary(diffVersions(v, v))).toEqual({ moved: 0, added: 0, removed: 0, same: 2 });
  });
});
