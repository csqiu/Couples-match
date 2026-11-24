/**
 * The whole-list map: each pair in the list as a line between the two programs,
 * styled by distance band. Pure, so it's unit-tested.
 */
import type { CoupleData } from '@pairwise/db';
import type { Band } from '@pairwise/engine';
import type { ListRow } from './final-list';

export type MapBand = Exclude<Band, 'no_match'>;
export const MAP_BANDS: MapBand[] = ['together', 'commutable', 'drivable', 'apart'];

export interface PairLine {
  rank: number;
  pairId: string;
  band: MapBand;
  label: string;
  /** [partner A's program, partner B's program], as [lon, lat]. */
  ends: [[number, number], [number, number]];
}

export interface ListMap {
  lines: PairLine[];
  /** Pairs in the range that can't be drawn: No Match, or a program without a location. */
  notShown: { noMatch: number; noLocation: number };
  counts: Record<MapBand, number>;
}

export function listMap(rows: ListRow[], programs: CoupleData['programs'], top: number): ListMap {
  const where = new Map(programs.flatMap((p) => (p.lat != null && p.lon != null ? [[p.id, [p.lon, p.lat] as [number, number]]] : [])));
  const lines: PairLine[] = [];
  const notShown = { noMatch: 0, noLocation: 0 };
  const counts: Record<MapBand, number> = { together: 0, commutable: 0, drivable: 0, apart: 0 };
  for (const row of rows.slice(0, top)) {
    if (row.band === 'no_match') {
      notShown.noMatch++;
      continue;
    }
    const a = where.get(row.sides[0].id);
    const b = where.get(row.sides[1].id);
    if (!a || !b) {
      notShown.noLocation++;
      continue;
    }
    counts[row.band]++;
    lines.push({ rank: row.rank, pairId: row.pairId, band: row.band, label: `#${row.rank}: ${row.sides[0].name} + ${row.sides[1].name}`, ends: [a, b] });
  }
  return { lines, notShown, counts };
}

export function toGeoJSON(lines: PairLine[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lines.flatMap((l) => [
      { type: 'Feature' as const, properties: { rank: l.rank, band: l.band, label: l.label, kind: 'line' }, geometry: { type: 'LineString' as const, coordinates: l.ends } },
      ...l.ends.map((c, k) => ({
        type: 'Feature' as const,
        properties: { rank: l.rank, band: l.band, label: l.label, kind: k === 0 ? 'a' : 'b' },
        geometry: { type: 'Point' as const, coordinates: c },
      })),
    ]),
  };
}

export function boundsOf(lines: PairLine[]): [[number, number], [number, number]] | null {
  if (!lines.length) return null;
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const l of lines)
    for (const [lon, lat] of l.ends) {
      w = Math.min(w, lon);
      e = Math.max(e, lon);
      s = Math.min(s, lat);
      n = Math.max(n, lat);
    }
  return [[w, s], [e, n]];
}
