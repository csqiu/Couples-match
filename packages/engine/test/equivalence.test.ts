import { describe, expect, it } from 'vitest';
import {
  NO_MATCH,
  buildCandidates,
  buildConstraintGraph,
  isMootComparison,
  isSameProgramPair,
  matchOutcome,
  mootWitnesses,
  pairId,
  runEngine,
  tidyOrder,
  type TidyRow,
  unreachableRows,
  type ProgramRef,
  type Reachable,
} from '../src/index';
import { emptyInput, list, METROS, program, rng } from './helpers';

type Row = [ProgramRef, ProgramRef];
const NM = NO_MATCH;

// Partner 1 ranks p, q, r; partner 2 ranks q, r, s. q and r are on both lists, so rows
// like (q, q) need two positions at q at once.
const P1 = ['p', 'q', 'r'];
const P2 = ['q', 'r', 's'];
const ALL_ROWS: Row[] = [...P1, NM].flatMap((a) => [...P2, NM].map((b): Row => [a, b])).filter(([a, b]) => !(a === NM && b === NM));

function subsets<T>(xs: T[]): T[][] {
  return xs.reduce<T[][]>((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]);
}

/** Every way the Match could turn out: each partner's reachable programs, and where both fit at once. */
const SCENARIOS: Reachable[] = subsets(P1).flatMap((f1) =>
  subsets(P2).flatMap((f2) =>
    subsets(f1.filter((x) => f2.includes(x))).map((both) => ({ partners: [new Set(f1), new Set(f2)], both: new Set(both) }) as Reachable),
  ),
);

/** The pair the couple matches on in scenario s ('' = neither matches). */
const matchedPair = (rows: Row[], s: Reachable) => {
  const i = matchOutcome(rows, s);
  return i === -1 ? '' : pairId(...rows[i]);
};
const sameOutcomes = (a: Row[], b: Row[]) => SCENARIOS.every((s) => matchedPair(a, s) === matchedPair(b, s));

function randomList(seed: number): Row[] {
  const r = rng(seed);
  const rows = ALL_ROWS.filter(() => r.next() < 0.8);
  for (let i = rows.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [rows[i], rows[j]] = [rows[j], rows[i]];
  }
  return rows;
}

describe('Match outcome model', () => {
  it('matches on the first row where both sides are reachable', () => {
    const rows: Row[] = [['p', 's'], ['q', 'q'], ['q', 'r'], ['p', NM]];
    const reach = (f1: string[], f2: string[], both: string[] = []): Reachable => ({ partners: [new Set(f1), new Set(f2)], both: new Set(both) });
    expect(matchOutcome(rows, reach(['p'], ['s']))).toBe(0);
    // q is reachable for each partner, but there is room for only one of them.
    expect(matchOutcome(rows, reach(['q'], ['q', 'r']))).toBe(2);
    expect(matchOutcome(rows, reach(['q'], ['q', 'r'], ['q']))).toBe(1);
    expect(matchOutcome(rows, reach(['p'], []))).toBe(3);
    expect(matchOutcome(rows, reach([], []))).toBe(-1);
  });
});

describe('Moot comparisons (brute force over every scenario)', () => {
  it('swapping two rows with a box pair above both never changes the outcome', () => {
    let checked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rows = randomList(seed);
      const pos = new Map(rows.map((row, i) => [pairId(...row), i]));
      for (let i = 0; i + 1 < rows.length; i++) {
        const moot = mootWitnesses(rows[i], rows[i + 1]).some((w) => (pos.get(w) ?? Infinity) < i);
        if (!moot) continue;
        const swapped = rows.slice();
        [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
        expect(sameOutcomes(rows, swapped), `${pairId(...rows[i])} vs ${pairId(...rows[i + 1])} in list ${seed}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('with nothing from the box above, the order of two rows can decide the outcome', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rows = randomList(seed);
      const pos = new Map(rows.map((row, i) => [pairId(...row), i]));
      for (let i = 0; i + 1 < rows.length; i++) {
        const [x, y] = [rows[i], rows[i + 1]];
        // The whole box, same-program pairs included: if none is above, the order matters.
        const box = [x[0], y[0], NM].flatMap((a) => [x[1], y[1], NM].map((b) => pairId(a, b)));
        if (box.some((c) => c !== pairId(...x) && c !== pairId(...y) && (pos.get(c) ?? Infinity) < i)) continue;
        const swapped = rows.slice();
        [swapped[i], swapped[i + 1]] = [y, x];
        expect(sameOutcomes(rows, swapped), `${pairId(...x)} vs ${pairId(...y)} in list ${seed}`).toBe(false);
      }
    }
  });

  it('a pair with both partners at one program is never a witness', () => {
    // Being reachable at q separately doesn't mean there's room for both at q.
    expect(mootWitnesses(['q', 's'], ['p', 'q'])).not.toContain(pairId('q', 'q'));
    const rows: Row[] = [['q', 'q'], ['q', 's'], ['p', 'q']];
    const swapped: Row[] = [['q', 'q'], ['p', 'q'], ['q', 's']];
    expect(sameOutcomes(rows, swapped)).toBe(false);
    expect(isSameProgramPair(['q', 'q'])).toBe(true);
    expect(isSameProgramPair([NM, 's'])).toBe(false);
  });

  it('isMootComparison: same-program pairs don\'t count, half-No-Match pairs do', () => {
    const input = emptyInput({ tierARule: ['off', 'off'], noMatchAtBottom: false });
    for (const id of ['p', 'q', 's']) input.programs[id] = program(id, METROS[2]);
    input.lists = [list([['q', 'B'], ['p', 'B']]), list([['q', 'B'], ['s', 'B']])];
    const graph = buildConstraintGraph(buildCandidates(input), input);
    const i = (a: string, b: string) => graph.index.get(pairId(a, b))!;
    const aboveIf = (...higher: number[]) => (c: number) => higher.includes(c);
    // (q, q) above (q, s) and (p, q): not moot, since there may be room at q for only one.
    expect(isMootComparison(graph, i('q', 's'), i('p', 'q'), aboveIf(i('q', 'q')))).toBe(false);
    // (p, s), the other swapped pair, still makes it moot.
    expect(isMootComparison(graph, i('q', 's'), i('p', 'q'), aboveIf(i('p', 's')))).toBe(true);
    // Shared program, (q, No Match) above both (q, q) and (q, s): moot, since q reachable means (q, No Match) is.
    expect(isMootComparison(graph, i('q', 'q'), i('q', 's'), aboveIf(i('q', NM)))).toBe(true);
    // Different programs, (No Match, s) above (q, s) and (p, q): moot.
    expect(isMootComparison(graph, i('q', 's'), i('p', 'q'), aboveIf(i(NM, 's')))).toBe(true);
    // A pair outside the box doesn't count.
    expect(isMootComparison(graph, i('q', 'q'), i('q', 's'), aboveIf(i('p', NM)))).toBe(false);
  });
});

describe('Unreachable rows', () => {
  it('flags rows below (A, No Match), (No Match, B) or a copy of themselves', () => {
    const rows: Row[] = [['p', 's'], ['p', NM], ['q', 's'], ['p', 'q'], [NM, 's'], ['r', 's'], ['p', 's'], ['p', NM]];
    expect(unreachableRows(rows).map((u) => [u.index, u.blockedByIndex])).toEqual([
      [3, 1], // (p, q) below (p, No Match)
      [5, 4], // (r, s) below (No Match, s)
      [6, 0], // a copy of row 0 (also below (p, No Match) and (No Match, s))
      [7, 1], // a copy of (p, No Match)
    ]);
  });

  it('matches brute force: a flagged row is never the match, every other row sometimes is', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = rng(seed);
      // Lists with repeats, so copies get tested too.
      const rows = Array.from({ length: r.int(3, 20) }, () => r.pick(ALL_ROWS));
      const flagged = new Set(unreachableRows(rows).map((u) => u.index));
      const reached = new Set(SCENARIOS.map((s) => matchOutcome(rows, s)));
      rows.forEach((_, i) => expect(reached.has(i), `row ${i} of list ${seed}`).toBe(!flagged.has(i)));
    }
  });

  it('the engine\'s default list (No Match at the bottom) has none', () => {
    const input = emptyInput();
    METROS.slice(0, 6).forEach((m, k) => (input.programs[`a${k}`] = program(`a${k}`, m)));
    METROS.slice(3, 9).forEach((m, k) => (input.programs[`b${k}`] = program(`b${k}`, m)));
    input.lists = [list([0, 1, 2, 3, 4, 5].map((k) => [`a${k}`, k < 2 ? 'A' : 'B'])), list([0, 1, 2, 3, 4, 5].map((k) => [`b${k}`, 'B']))];
    const { list: ranked } = runEngine(input);
    expect(ranked.rows.length).toBe(48);
    expect(unreachableRows(ranked.rows.map((r) => r.pair.programs))).toEqual([]);
  });
});

describe('Readable order (tidyOrder)', () => {
  const rankOf = (k: 0 | 1, p: ProgramRef) => (p === NM ? 99 : (k === 0 ? P1 : P2).indexOf(p) + 1);
  const toRows = (rows: Row[]): TidyRow[] => rows.map(([a, b]) => ({ id: pairId(a, b), programs: [a, b], rank: [rankOf(0, a), rankOf(1, b)] }));
  const back = (rows: TidyRow[]): Row[] => rows.map((r) => [r.programs[0], r.programs[1]]);

  it('never changes the outcome, for any key (brute force)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rows = randomList(seed);
      for (const key of ['partner1', 'partner2', 'balanced'] as const) {
        expect(sameOutcomes(rows, back(tidyOrder(toRows(rows), key))), `list ${seed}, ${key}`).toBe(true);
      }
    }
  });

  it('turns one ordering of the box into the other', () => {
    // Two programs each, no shared programs: the figure in the guide.
    const a = ['a1', 'b1', NM];
    const b = ['a2', 'b2', NM];
    const rank = (xs: string[], p: string) => xs.indexOf(p) + 1;
    const rows = (outer: 0 | 1): TidyRow[] =>
      (outer === 0 ? a.flatMap((x) => b.map((y) => [x, y])) : b.flatMap((y) => a.map((x) => [x, y])))
        .filter(([x, y]) => !(x === NM && y === NM))
        .map(([x, y]) => ({ id: pairId(x, y), programs: [x, y], rank: [rank(a, x), rank(b, y)] }));
    const ids = (rs: TidyRow[]) => rs.map((r) => r.id);
    expect(ids(tidyOrder(rows(1), 'partner1'))).toEqual(ids(rows(0)));
    expect(ids(tidyOrder(rows(0), 'partner2'))).toEqual(ids(rows(1)));
  });

  it('leaves locked rows and ordered neighbours alone', () => {
    const all = toRows([['p', 'q'], ['r', 'q'], ['p', 's']]);
    // (r, q) and (p, s): (p, q) is above both, so partner 1's order may swap them…
    expect(tidyOrder(all, 'partner1').map((r) => r.id)).toEqual(['p|q', 'p|s', 'r|q']);
    // …unless one of them is locked, or something orders them.
    const locked = all.map((r, i) => (i === 2 ? { ...r, locked: true } : r));
    expect(tidyOrder(locked, 'partner1').map((r) => r.id)).toEqual(['p|q', 'r|q', 'p|s']);
    expect(tidyOrder(all, 'partner1', (h, l) => h === 'r|q' && l === 'p|s').map((r) => r.id)).toEqual(['p|q', 'r|q', 'p|s']);
  });
});
