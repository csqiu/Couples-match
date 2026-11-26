/**
 * Which rows of a couple's list can decide where they match, and which can't.
 *
 * Model: on Match Day each partner has a set of programs they could get into (their
 * "reachable" programs); No Match is always reachable. The couple matches on the first
 * row whose two sides are both reachable. A row that puts both partners at the same
 * program also needs two open positions there at once, which being reachable for each
 * partner separately doesn't guarantee. See DECISIONS.md and the "How the Couples Match
 * Works" guide.
 */
import { pairId } from './candidates';
import { NO_MATCH, type PairId, type ProgramRef } from './types';

type Sides = readonly [ProgramRef, ProgramRef];

/** True for a row that puts both partners at the same (real) program. */
export function isSameProgramPair([a, b]: Sides): boolean {
  return a === b && a !== NO_MATCH;
}

/**
 * The pairs that make the order of rows x and y irrelevant when one of them sits above
 * both. They come from the "box" {x₁, y₁, No Match} × {x₂, y₂, No Match}: if x and y are
 * both reachable, every pair in the box is too, so the Match stops at the higher one
 * first. Left out: x and y themselves, (No Match, No Match), which is never a row, and
 * pairs that put both partners at one program, which need two positions there at once.
 */
export function mootWitnesses(x: Sides, y: Sides): PairId[] {
  const xId = pairId(x[0], x[1]);
  const yId = pairId(y[0], y[1]);
  const out = new Set<PairId>();
  for (const a of new Set([x[0], y[0], NO_MATCH])) {
    for (const b of new Set([x[1], y[1], NO_MATCH])) {
      if (a === NO_MATCH && b === NO_MATCH) continue;
      if (isSameProgramPair([a, b])) continue;
      const id = pairId(a, b);
      if (id !== xId && id !== yId) out.add(id);
    }
  }
  return [...out];
}

export interface UnreachableRow {
  /** 0-based position of the row that can never be the match. */
  index: number;
  pair: PairId;
  /** 0-based position of the earlier row that always works first. */
  blockedByIndex: number;
  blockedBy: PairId;
}

/**
 * Rows that can never be where the couple matches: a row (A, B) below (A, No Match),
 * below (No Match, B), or below a copy of itself. Whenever (A, B) is reachable, that
 * earlier row is too, and it comes first. Such rows change nothing, but they take up
 * room under the rank limit and can add fees.
 */
export function unreachableRows(rows: readonly Sides[]): UnreachableRow[] {
  const first = new Map<PairId, number>();
  const out: UnreachableRow[] = [];
  rows.forEach(([a, b], index) => {
    const id = pairId(a, b);
    const blockers = [id];
    if (a !== NO_MATCH && b !== NO_MATCH) blockers.push(pairId(a, NO_MATCH), pairId(NO_MATCH, b));
    let best = -1;
    for (const c of blockers) {
      const at = first.get(c);
      if (at !== undefined && (best === -1 || at < best)) best = at;
    }
    if (best !== -1) out.push({ index, pair: id, blockedByIndex: best, blockedBy: pairId(...rows[best]) });
    if (!first.has(id)) first.set(id, index);
  });
  return out;
}

export interface Reachable {
  /** Programs partner 1 / partner 2 could get into (No Match is always reachable). */
  partners: [ReadonlySet<ProgramRef>, ReadonlySet<ProgramRef>];
  /** Programs with room for both partners at once. Defaults to none. */
  both?: ReadonlySet<ProgramRef>;
}

/** The 0-based row the couple matches on under this model, or -1 for neither matching. */
export function matchOutcome(rows: readonly Sides[], reach: Reachable): number {
  const [r1, r2] = reach.partners;
  const ok = (r: ReadonlySet<ProgramRef>, p: ProgramRef) => p === NO_MATCH || r.has(p);
  return rows.findIndex(
    ([a, b]) => ok(r1, a) && ok(r2, b) && (!isSameProgramPair([a, b]) || (reach.both?.has(a) ?? false)),
  );
}
