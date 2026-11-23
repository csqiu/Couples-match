import type { ListRow } from './final-list';

/** The final list as CSV, in R3 entry order. */
export function toCsv(rows: ListRow[], names: [string, string]): string {
  const q = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Rank', `${names[0]} program`, `${names[0]} NRMP code`, `${names[1]} program`, `${names[1]} NRMP code`, 'Distance (mi)', 'Band'];
  const lines = rows.map((r) => [
    r.rank,
    r.sides[0].name,
    r.sides[0].code,
    r.sides[1].name,
    r.sides[1].code,
    r.distanceMi == null ? '' : Math.round(r.distanceMi),
    r.bandLabel,
  ]);
  return [header, ...lines].map((l) => l.map(q).join(',')).join('\n') + '\n';
}

