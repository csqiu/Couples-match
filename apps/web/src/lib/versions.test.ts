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

describe('printing a saved version', () => {
  it('gets the same checklist and fee estimate as the live list', async () => {
    const { versionAsListRows } = await import('./versions');
    const { checklistFor, feesFor } = await import('./final-list');
    const rows = [
      { rank: 1, pairId: 'a|b', a: { id: 'a', name: 'Hosp A — IM', code: '1234140C0' }, b: { id: 'b', name: 'Hosp B — Peds', code: '' }, distanceMi: 3, band: 'together' as const, bandLabel: 'Together' },
      { rank: 2, pairId: 'a|NO_MATCH', a: { id: 'a', name: 'Hosp A — IM', code: '1234140C0' }, b: { id: 'NO_MATCH', name: 'No Match', code: '999999999' }, distanceMi: null, band: 'no_match' as const, bandLabel: 'No Match' },
    ];
    const asRows = versionAsListRows(rows);
    const items = checklistFor(asRows, asRows.length, ['Alex', 'Sam'], false);
    expect(items.find((i) => i.label.startsWith('Sam'))?.ok).toBe(false);
    expect(items.find((i) => i.label.startsWith('Alex'))?.ok).toBe(true);
    expect(feesFor(asRows, asRows.length).ranks).toBe(2);
  });
});
