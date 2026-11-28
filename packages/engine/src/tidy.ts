/**
 * A readable version of a list that matches exactly the same way (Section "readable
 * list", DECISIONS.md #120).
 *
 * Two neighbouring rows X and Y can trade places without changing the outcome in any
 * scenario when a row from their box (see mootWitnesses) sits above both: whenever both
 * are reachable, that row is too, and the Match stops there first. Swapping them keeps
 * that row above both, so swaps can be repeated. tidyOrder bubble-sorts the list by a
 * reading key using only such swaps, so the result is outcome-equivalent to the input
 * and as sorted as those swaps allow.
 *
 * It also never swaps two rows that a rule, an answer or a drag orders (so every "why"
 * still reads right), or a locked row.
 */
import { mootWitnesses } from './equivalence';
import type { Pair, PairId, ProgramRef } from './types';

/** How to read the list: by partner 1's ranks, by partner 2's, or by both together. */
export type TidyKey = 'partner1' | 'partner2' | 'balanced';

type Sides = readonly [ProgramRef, ProgramRef];

export interface TidyRow {
  id: PairId;
  programs: Sides;
  /** Each partner's rank for this row's program (No Match ranks after every program). */
  rank: readonly [number, number];
  /** Locked rows never move. */
  locked?: boolean;
}

export function tidyRowOf(p: Pair, locked = false): TidyRow {
  return { id: p.id, programs: p.programs, rank: p.rank, locked };
}

function sortKey(r: TidyRow, key: TidyKey): [number, number, number] {
  const [a, b] = r.rank;
  switch (key) {
    case 'partner1':
      return [a, b, 0];
    case 'partner2':
      return [b, a, 0];
    case 'balanced':
      return [a + b, Math.max(a, b), a];
  }
}

function before(x: TidyRow, y: TidyRow, key: TidyKey): boolean {
  const kx = sortKey(x, key);
  const ky = sortKey(y, key);
  for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return kx[i] < ky[i];
  return false;
}

/** The highest row above position `i` (exclusive) that comes from the box of rows i and i+1, or null. */
export function witnessAbove(order: readonly TidyRow[], position: ReadonlyMap<PairId, number>, i: number): PairId | null {
  let best: PairId | null = null;
  let bestAt = Infinity;
  for (const w of mootWitnesses(order[i].programs, order[i + 1].programs)) {
    const at = position.get(w);
    if (at !== undefined && at < i && at < bestAt) {
      best = w;
      bestAt = at;
    }
  }
  return best;
}

/**
 * Reorders `rows` into the most readable outcome-equivalent order reachable by swapping
 * neighbours whose order cannot matter. `ordered(x, y)` is true when x must stay above y
 * (a rule, an answer or a drag); such neighbours are never swapped.
 */
export function tidyOrder(
  rows: readonly TidyRow[],
  key: TidyKey,
  ordered: (higher: PairId, lower: PairId) => boolean = () => false,
): TidyRow[] {
  const order = rows.slice();
  const position = new Map(order.map((r, i) => [r.id, i]));
  let swapped = true;
  for (let pass = 0; swapped && pass < order.length; pass++) {
    swapped = false;
    for (let i = 0; i + 1 < order.length; i++) {
      const x = order[i];
      const y = order[i + 1];
      if (x.locked || y.locked || !before(y, x, key) || ordered(x.id, y.id)) continue;
      if (witnessAbove(order, position, i) === null) continue;
      order[i] = y;
      order[i + 1] = x;
      position.set(y.id, i);
      position.set(x.id, i + 1);
      swapped = true;
    }
  }
  return order;
}
