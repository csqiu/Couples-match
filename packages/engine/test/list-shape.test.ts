import { describe, expect, it } from 'vitest';
import {
  NO_MATCH,
  allOpenQuestions,
  buildCandidates,
  buildConstraintGraph,
  hardClosure,
  isMootComparison,
  mustRankAbove,
  nextQuestions,
  priorPosterior,
  proposeMove,
  rankPairs,
  runEngine,
  scorePairs,
  type EngineInput,
} from '../src/index';
import { simulatedInput } from '../src/bench/simulate';
import { emptyInput, list, METROS, program } from './helpers';

function setup(input: EngineInput) {
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  const prior = priorPosterior(input.seed, 500);
  const ranked = rankPairs(graph, scorePairs(pairs, prior, input.settings), { length: 10_000 });
  return { pairs, graph, prior, ranked };
}

describe('Moot comparisons', () => {
  it('(Hopkins, X) vs (Y, Penn) is moot when (Hopkins, Penn) must rank above both', () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    // All in one metro, so (Hopkins, Penn) is as close as the others and dominates both.
    for (const id of ['hopkins', 'y', 'penn', 'x']) input.programs[id] = program(id, METROS[2]);
    input.lists = [list([['hopkins', 'B'], ['y', 'B']]), list([['penn', 'B'], ['x', 'B']])];
    const { graph } = setup(input);
    const closure = hardClosure(graph);
    const i = (id: string) => graph.index.get(id)!;
    const hard = (c: number, x: number) => mustRankAbove(closure, c, x);
    expect(isMootComparison(graph, i('hopkins|x'), i('y|penn'), hard)).toBe(true);
    // One program in common: there is no swapped pair, so the order matters.
    expect(isMootComparison(graph, i('hopkins|x'), i('hopkins|penn'), hard)).toBe(false);
    // No Match on both sides of the swap: (Hopkins, No Match) vs (No Match, Penn).
    expect(isMootComparison(graph, i(`hopkins|${NO_MATCH}`), i(`${NO_MATCH}|penn`), hard)).toBe(true);
  });

  it('is not moot when the swapped pair is excluded', () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    for (const [id, m] of [['hopkins', 2], ['y', 8], ['penn', 8], ['x', 2]] as const) input.programs[id] = program(id, METROS[m]);
    input.lists = [list([['hopkins', 'B'], ['y', 'B']]), list([['penn', 'B'], ['x', 'B']])];
    input.exclusions = [{ programA: 'hopkins', programB: 'penn' }];
    const { graph } = setup(input);
    const closure = hardClosure(graph);
    const i = (id: string) => graph.index.get(id)!;
    expect(isMootComparison(graph, i('hopkins|x'), i('y|penn'), (c, x) => mustRankAbove(closure, c, x))).toBe(false);
  });

  it('the engine never asks a moot question', () => {
    for (const seed of [3, 5, 8]) {
      const input = simulatedInput(seed);
      const { graph, prior, ranked } = setup(input);
      const closure = hardClosure(graph);
      const hard = (c: number, x: number) => mustRankAbove(closure, c, x);
      for (const q of allOpenQuestions(ranked, prior)) {
        expect(isMootComparison(graph, graph.index.get(q.left)!, graph.index.get(q.right)!, hard)).toBe(false);
      }
      expect(nextQuestions(ranked, prior, 5).length).toBeGreaterThan(0);
    }
  });
});

describe('Manual drags land where they were dropped', () => {
  const input = simulatedInput(5);
  const base = runEngine(input).list;
  const before = base.order;
  /** The first (from, to) pair of positions the hard rules allow, scanning outward from `from`. */
  function allowed(dir: 'up' | 'down') {
    for (let from = 5; from < 60; from++) {
      for (let gap = 4; gap < 12; gap++) {
        const to = dir === 'up' ? from - gap : from + gap;
        if (to < 0) continue;
        const [higher, lower] = dir === 'up' ? [before[from], before[to]] : [before[to], before[from]];
        const res = proposeMove(base, higher, lower, dir === 'up' ? 'higher' : 'lower');
        if (res.ok) return { from, to, pin: res.pin };
      }
    }
    throw new Error('no allowed move found');
  }

  it('a pair dragged up lands right above the target; only pairs that must stay above it come along', () => {
    const { from, to, pin } = allowed('up');
    const res = runEngine({ ...input, pins: [pin] });
    const after = res.list.order;
    const moving = before[from];
    expect(after.indexOf(moving)).toBe(after.indexOf(before[to]) - 1);
    expect(after.slice(0, to)).toEqual(before.slice(0, to));
    const closure = hardClosure(res.graph);
    for (const id of after.slice(to, after.indexOf(moving))) {
      expect(mustRankAbove(closure, res.graph.index.get(id)!, res.graph.index.get(moving)!)).toBe(true);
    }
  });

  it('a pair dragged down lands right below the target', () => {
    const { from, to, pin } = allowed('down');
    const after = runEngine({ ...input, pins: [pin] }).list.order;
    expect(after.indexOf(before[from])).toBe(after.indexOf(before[to]) + 1);
    expect(after.slice(0, from)).toEqual(before.slice(0, from));
  });

  it('without a direction (older pins) the pin still holds', () => {
    const { from, to, pin } = allowed('up');
    const { moved: _moved, ...legacy } = pin;
    const after = runEngine({ ...input, pins: [legacy] }).list.order;
    expect(after.indexOf(before[from])).toBeLessThan(after.indexOf(before[to]));
  });
});

describe('No Match order', () => {
  it('No Match pairs end the list as 1–NM, 2–NM, …, then NM–1, NM–2, …; never NM–NM', () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    for (const id of ['a1', 'a2', 'a3', 'b1', 'b2']) input.programs[id] = program(id, METROS[0]);
    input.lists = [list([['a1', 'B'], ['a2', 'B'], ['a3', 'C']]), list([['b1', 'B'], ['b2', 'B']])];
    const order = runEngine(input).list.order;
    const nm = order.filter((id) => id.includes(NO_MATCH));
    expect(nm).toEqual([`a1|${NO_MATCH}`, `a2|${NO_MATCH}`, `a3|${NO_MATCH}`, `${NO_MATCH}|b1`, `${NO_MATCH}|b2`]);
    expect(order.slice(-5)).toEqual(nm);
  });
});

describe('A drag that breaks a rule stays where it was dropped until resolved', () => {
  it('up and down, while the clash is a conflict', () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    for (const id of ['a1', 'a2', 'a3', 'b1']) input.programs[id] = program(id, METROS[0]);
    input.lists = [list([['a1', 'B'], ['a2', 'B'], ['a3', 'B']]), list([['b1', 'B']])];
    const before = runEngine(input).list.order;
    expect(before.slice(0, 3)).toEqual(['a1|b1', 'a2|b1', 'a3|b1']);
    // a3|b1 is dominated by a1|b1 and a2|b1; drag it to the top anyway.
    const up = runEngine({ ...input, pins: [{ higher: 'a3|b1', lower: 'a1|b1', source: 'manual_drag', moved: 'higher' }] });
    expect(up.conflicts.some((c) => c.kind === 'cycle')).toBe(true);
    expect(up.list.order.slice(0, 3)).toEqual(['a3|b1', 'a1|b1', 'a2|b1']);
    // a1|b1 dragged to the bottom (below a3|b1).
    const down = runEngine({ ...input, pins: [{ higher: 'a3|b1', lower: 'a1|b1', source: 'manual_drag', moved: 'lower' }] });
    expect(down.list.order.slice(0, 3)).toEqual(['a2|b1', 'a3|b1', 'a1|b1']);
  });
});
