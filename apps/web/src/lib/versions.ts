/** Saved versions: the frozen row format and the side-by-side diff. Pure. */
import type { Band } from '@pairwise/engine';
import type { ListRow } from './final-list';

/** One row as frozen in list_versions.pairs. */
export interface VersionRow {
  rank: number;
  pairId: string;
  a: { id: string; name: string; code: string };
  b: { id: string; name: string; code: string };
  distanceMi: number | null;
  band: Band;
  bandLabel: string;
}

export function toVersionRows(rows: ListRow[], length: number): VersionRow[] {
  return rows.slice(0, length).map((r) => ({
    rank: r.rank,
    pairId: r.pairId,
    a: { id: r.sides[0].id, name: r.sides[0].name, code: r.sides[0].code },
    b: { id: r.sides[1].id, name: r.sides[1].name, code: r.sides[1].code },
    distanceMi: r.distanceMi,
    band: r.band,
    bandLabel: r.bandLabel,
  }));
}

export type DiffKind = 'same' | 'up' | 'down' | 'added' | 'removed';

export interface DiffRow {
  pairId: string;
  row: VersionRow;
  /** Rank in the older (left) and newer (right) version. */
  before: number | null;
  after: number | null;
  kind: DiffKind;
}

/**
 * Compares two versions. Rows are listed in the newer version's order, then
 * rows that were removed, in their old order.
 */
export function diffVersions(older: VersionRow[], newer: VersionRow[]): DiffRow[] {
  const oldRank = new Map(older.map((r) => [r.pairId, r.rank]));
  const newIds = new Set(newer.map((r) => r.pairId));
  const rows: DiffRow[] = newer.map((r) => {
    const before = oldRank.get(r.pairId) ?? null;
    const kind: DiffKind = before === null ? 'added' : before === r.rank ? 'same' : before > r.rank ? 'up' : 'down';
    return { pairId: r.pairId, row: r, before, after: r.rank, kind };
  });
  for (const r of older) {
    if (!newIds.has(r.pairId)) rows.push({ pairId: r.pairId, row: r, before: r.rank, after: null, kind: 'removed' });
  }
  return rows;
}

export function diffSummary(rows: DiffRow[]) {
  const count = (k: DiffKind) => rows.filter((r) => r.kind === k).length;
  return { moved: count('up') + count('down'), added: count('added'), removed: count('removed'), same: count('same') };
}
