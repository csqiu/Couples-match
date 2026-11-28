/** "Make a specific comparison": each partner's rank list and the pairs four picks make. Pure. */
import type { PairView, ProgramSide } from './pair-view';

export const NO_MATCH = 'NO_MATCH';

/** [partner A's program, partner B's program]; null = not chosen yet, 'NO_MATCH' = No Match. */
export type Picks = [string | null, string | null];

/** Each partner's programs that can be in a pair, best first (from the engine's pairs). */
export function rankLists(pairs: Array<Pick<PairView, 'sides'>>): [ProgramSide[], ProgramSide[]] {
  const lists = [new Map<string, ProgramSide>(), new Map<string, ProgramSide>()];
  for (const p of pairs) {
    p.sides.forEach((s, k) => {
      if (s && !lists[k].has(s.id)) lists[k].set(s.id, s);
    });
  }
  const byRank = (x: ProgramSide, y: ProgramSide) => (x.rank ?? Infinity) - (y.rank ?? Infinity) || x.name.localeCompare(y.name);
  return [[...lists[0].values()].sort(byRank), [...lists[1].values()].sort(byRank)];
}

/** The pair id for two picks, or null while either is missing. */
export function pairIdOf(pick: Picks): string | null {
  return pick[0] && pick[1] ? `${pick[0]}|${pick[1]}` : null;
}

/** Splits a pair id from a link (`?a=`), or empty picks if it isn't one. */
export function pickFromPairId(id: string | null | undefined): Picks {
  const parts = id?.split('|');
  return parts && parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : [null, null];
}

export type SpecificState =
  | { kind: 'choosing'; missing: number }
  | { kind: 'both-no-match' }
  | { kind: 'same' }
  | { kind: 'ready'; a: string; b: string };

/** Where the four picks stand. */
export function specificState(a: Picks, b: Picks): SpecificState {
  const missing = [...a, ...b].filter((x) => !x).length;
  if (missing) return { kind: 'choosing', missing };
  if ((a[0] === NO_MATCH && a[1] === NO_MATCH) || (b[0] === NO_MATCH && b[1] === NO_MATCH)) return { kind: 'both-no-match' };
  const ia = pairIdOf(a)!;
  const ib = pairIdOf(b)!;
  if (ia === ib) return { kind: 'same' };
  return { kind: 'ready', a: ia, b: ib };
}
