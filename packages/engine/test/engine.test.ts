import { describe, expect, it } from 'vitest';
import {
  NO_MATCH,
  NRMP_RULES,
  breakLink,
  buildCandidates,
  buildConstraintGraph,
  defaultPosterior,
  dominates,
  explainOrder,
  extraRankFeeUsd,
  feeEstimate,
  findConflicts,
  isNoMatchPair,
  lengthFeeUsd,
  pairId,
  proposeMove,
  rankPairs,
  runEngine,
  scorePairs,
  violatedEdges,
  type EngineInput,
  type TierARuleMode,
  type TierAPriority,
} from '../src/index.js';
import { METROS, emptyInput, list, program, randomInput, randomParams, rng } from './helpers.js';

const MODES: TierARuleMode[] = ['hard', 'strong', 'off'];
const PRIORITIES: TierAPriority[] = [null, 'partner1', 'partner2', 'case_by_case'];

function randomCase(seed: number) {
  const r = rng(seed * 7919);
  const input = randomInput(seed, r.int(3, 14), r.int(3, 14), {
    tierARule: [r.pick(MODES), r.pick(MODES)],
    tierAPriority: r.pick(PRIORITIES),
    noMatchAtBottom: r.next() > 0.3,
    balance: r.range(0.2, 1.8),
  });
  const posterior = defaultPosterior(randomParams(seed));
  return { input, posterior };
}

function rank(input: EngineInput, posterior = defaultPosterior()) {
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  const scores = scorePairs(pairs, posterior, input.settings);
  return { pairs, graph, list: rankPairs(graph, scores, { length: 10_000 }) };
}

describe('1. Dominance holds', () => {
  it('a pair both partners like at least as much, no farther apart, always ranks higher — for any parameters', () => {
    let checked = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const { input, posterior } = randomCase(seed);
      const { pairs, list } = rank(input, posterior);
      expect(list.hasCycles).toBe(false);
      for (const x of pairs) {
        for (const y of pairs) {
          if (x !== y && dominates(x, y)) {
            checked++;
            expect(list.position.get(x.id)!).toBeLessThan(list.position.get(y.id)!);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('with the partner fixed, a strictly better program at the same or closer band ranks higher', () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    input.programs = {
      a1: program('a1', METROS[0]),
      a2: program('a2', METROS[4]),
      b1: program('b1', METROS[0]),
    };
    input.lists = [list([['a1', 'B'], ['a2', 'B']]), list([['b1', 'B']])];
    // Make "apart" free and partner 1's #2 hugely valuable: dominance must still win.
    const params = randomParams(3);
    params.pen.apart = -100;
    const { list: ranked } = rank(input, defaultPosterior(params));
    expect(ranked.position.get('a1|b1')!).toBeLessThan(ranked.position.get('a2|b1')!);
  });
});

describe('2. No Match at bottom', () => {
  it('no NO_MATCH pair ever ranks above a both-matched pair', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { input, posterior } = randomCase(seed);
      input.settings.noMatchAtBottom = true;
      const { list } = rank(input, posterior);
      let seenNoMatch = false;
      for (const id of list.order) {
        const nm = id.startsWith(`${NO_MATCH}|`) || id.endsWith(`|${NO_MATCH}`);
        if (nm) seenNoMatch = true;
        else expect(seenNoMatch).toBe(false);
      }
    }
  });
});

describe('3. Tier A hard rule', () => {
  const tierAHolds = (input: EngineInput, k: 0 | 1, seed: number) => {
    const { pairs, list } = rank(input, defaultPosterior(randomParams(seed)));
    const o = 1 - k;
    const tops = pairs.filter((p) => p.tier[k] === 'A' && p.programs[o] !== NO_MATCH);
    const bottoms = pairs.filter((p) => p.tier[k] !== 'A');
    const worstTop = Math.max(...tops.map((p) => list.position.get(p.id)!));
    const bestBottom = Math.min(...bottoms.map((p) => list.position.get(p.id)!));
    expect(tops.length).toBeGreaterThan(0);
    expect(worstTop).toBeLessThan(bestBottom);
  };

  it('holds for a partner with Tier A when the other partner has none', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const input = randomInput(seed, 10, 10, { tierARule: ['hard', 'hard'] });
      input.lists[0][0].tier = 'A';
      input.lists[0][0].acceptable = true;
      for (const e of input.lists[1]) if (e.tier === 'A') e.tier = 'B';
      tierAHolds(input, 0, seed);
    }
  });

  it('holds for the partner given priority when both have Tier A programs', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const input = randomInput(seed, 10, 10, { tierARule: ['hard', 'hard'], tierAPriority: 'partner2' });
      input.lists[1][0].tier = 'A';
      input.lists[1][0].acceptable = true;
      tierAHolds(input, 1, seed);
    }
  });
});

describe('4. Tier A collision detected', () => {
  const collisionInput = (priority: TierAPriority) => {
    const input = emptyInput({ tierARule: ['hard', 'hard'], tierAPriority: priority });
    input.programs = {
      a1: program('a1', METROS[0]), // Boston, partner 1's Tier A
      a2: program('a2', METROS[5]), // San Francisco
      b1: program('b1', METROS[5]), // San Francisco, partner 2's Tier A
      b2: program('b2', METROS[0]), // Boston
    };
    input.lists = [list([['a1', 'A'], ['a2', 'B']]), list([['b1', 'A'], ['b2', 'B']])];
    return input;
  };

  it('returns exactly one collision conflict when no priority is set', () => {
    const { conflicts } = runEngine(collisionInput(null));
    expect(conflicts.filter((c) => c.kind === 'tier_a_collision')).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });

  it.each(['partner1', 'partner2', 'case_by_case'] as const)('disappears once priority = %s', (p) => {
    const { conflicts, list } = runEngine(collisionInput(p));
    expect(conflicts).toHaveLength(0);
    expect(violatedEdges(list)).toHaveLength(0);
  });

  it('priority decides who gets Tier A when only one can', () => {
    const p1 = runEngine(collisionInput('partner1')).list;
    expect(p1.position.get('a1|b2')!).toBeLessThan(p1.position.get('a2|b1')!);
    const p2 = runEngine(collisionInput('partner2')).list;
    expect(p2.position.get('a2|b1')!).toBeLessThan(p2.position.get('a1|b2')!);
  });
});

describe('5. Cycle found and explained', () => {
  // Three mutually incomparable pairs in one city: (1,3), (2,2), (3,1).
  const base = () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    for (const id of ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']) input.programs[id] = program(id, METROS[1]);
    input.lists = [list([['a1', 'B'], ['a2', 'B'], ['a3', 'B']]), list([['b1', 'B'], ['b2', 'B'], ['b3', 'B']])];
    return input;
  };
  const A = pairId('a1', 'b3');
  const B = pairId('a2', 'b2');
  const C = pairId('a3', 'b1');

  it('pins A>B, B>C, C>A produce one conflict listing all three edges with reasons', () => {
    const input = base();
    input.pins = [
      { higher: A, lower: B, source: 'comparison', comparisonId: '#1' },
      { higher: B, lower: C, source: 'manual_drag' },
      { higher: C, lower: A, source: 'conflict_resolution' },
    ];
    const { conflicts } = runEngine(input);
    const cycles = conflicts.filter((c) => c.kind === 'cycle');
    expect(cycles).toHaveLength(1);
    const links = cycles[0].kind === 'cycle' ? cycles[0].links : [];
    expect(links).toHaveLength(3);
    expect(new Set(links.map((l) => `${l.from}>${l.to}`))).toEqual(new Set([`${A}>${B}`, `${B}>${C}`, `${C}>${A}`]));
    for (const l of links) expect(l.reasons.length).toBeGreaterThan(0);

    for (const link of links) {
      const fixed = runEngine(breakLink(input, link));
      expect(fixed.conflicts.filter((c) => c.kind === 'cycle')).toHaveLength(0);
      expect(fixed.list.hasCycles).toBe(false);
      expect(violatedEdges(fixed.list)).toHaveLength(0);
    }
  });

  it('a pin against an automatic rule is explained, and breaking the rule edge creates a scoped exception', () => {
    const input = base();
    const better = pairId('a1', 'b1');
    const worse = pairId('a2', 'b2');
    input.pins = [{ higher: worse, lower: better, source: 'manual_drag' }];
    const { conflicts } = runEngine(input);
    const cycle = conflicts.find((c) => c.kind === 'cycle');
    expect(cycle).toBeDefined();
    const links = cycle!.kind === 'cycle' ? cycle!.links : [];
    const ruleLink = links.find((l) => l.reasons.some((r) => r.kind === 'dominance'))!;
    expect(ruleLink).toBeDefined();
    let fixedInput = breakLink(input, ruleLink);
    expect(fixedInput.exceptions).toEqual([{ higher: ruleLink.from, lower: ruleLink.to }]);

    // Dominance is stored transitively reduced, so (a1,b1) is above (a2,b2) through two
    // intermediate pairs. Each break removes one route; keep breaking rule links until resolved.
    let fixed = runEngine(fixedInput);
    let steps = 1;
    while (fixed.conflicts.length && steps < 5) {
      const c = fixed.conflicts[0];
      expect(c.kind).toBe('cycle');
      const link = (c.kind === 'cycle' ? c.links : []).find((l) => l.reasons.every((r) => r.kind !== 'pin'))!;
      fixedInput = breakLink(fixedInput, link);
      fixed = runEngine(fixedInput);
      steps++;
    }
    expect(steps).toBeLessThanOrEqual(2);
    expect(fixed.conflicts).toHaveLength(0);
    expect(violatedEdges(fixed.list)).toHaveLength(0);
    expect(fixed.list.position.get(worse)!).toBeLessThan(fixed.list.position.get(better)!);
  });
});

describe('5b. Cycles through complete rules (hub edges)', () => {
  it('a pin putting a No Match pair on top is explained pair-to-pair and can be overridden', () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    for (const id of ['a1', 'b1']) input.programs[id] = program(id, METROS[0]);
    input.lists = [list([['a1', 'B']]), list([['b1', 'B']])];
    const nm = pairId('a1', NO_MATCH);
    input.pins = [{ higher: nm, lower: 'a1|b1', source: 'manual_drag' }];
    const { conflicts } = runEngine(input);
    const cycle = conflicts.find((c) => c.kind === 'cycle');
    const links = cycle && cycle.kind === 'cycle' ? cycle.links : [];
    expect(links.map((l) => [l.from, l.to])).toEqual(
      expect.arrayContaining([
        [nm, 'a1|b1'],
        ['a1|b1', nm],
      ]),
    );
    const rule = links.find((l) => l.from === 'a1|b1')!;
    expect(rule.reasons.map((r) => r.kind)).toContain('no_match_bottom');
    const fixed = runEngine(breakLink(input, rule));
    expect(fixed.conflicts).toHaveLength(0);
    expect(fixed.list.order[0]).toBe(nm);
    expect(violatedEdges(fixed.list)).toHaveLength(0);
  });
});

describe('6. Saturating distance', () => {
  it('800 mi apart and 2,500 mi apart score the same', () => {
    const make = (metroIdx: number) => {
      const input = emptyInput();
      input.programs = { a: program('a', METROS[0]), b: program('b', METROS[metroIdx]) };
      input.lists = [list([['a', 'B']]), list([['b', 'B']])];
      return buildCandidates(input).find((p) => p.id === 'a|b')!;
    };
    const chicago = make(4); // Boston–Chicago ≈ 850 mi
    const sf = make(5); // Boston–San Francisco ≈ 2,700 mi
    expect(chicago.distanceMi!).toBeGreaterThan(700);
    expect(sf.distanceMi!).toBeGreaterThan(2_400);
    expect(chicago.band).toBe('apart');
    expect(sf.band).toBe('apart');
    for (let seed = 1; seed <= 20; seed++) {
      const post = defaultPosterior(randomParams(seed));
      const s1 = scorePairs([chicago], post).get('a|b')!;
      const s2 = scorePairs([sf], post).get('a|b')!;
      expect(s1.mean).toBe(s2.mean);
    }
  });
});

describe('8. Determinism', () => {
  it('same inputs and seed give an identical list', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { input, posterior } = randomCase(seed);
      const a = runEngine(input, posterior);
      const b = runEngine(JSON.parse(JSON.stringify(input)), JSON.parse(JSON.stringify(posterior)));
      expect(b.list.order).toEqual(a.list.order);
      expect(b.conflicts).toEqual(a.conflicts);
    }
  });
});

describe('10. Limits and fees', () => {
  it('the list never exceeds 300 pairs', () => {
    const input = randomInput(42, 25, 25, { listLength: 10_000 });
    for (const k of [0, 1] as const) for (const e of input.lists[k]) e.acceptable = true;
    const { pairs, list } = runEngine(input);
    expect(pairs.length).toBe(26 * 26 - 1);
    expect(list.rows).toHaveLength(300);
    expect(rankPairs(list.graph, list.scores, { length: 120 }).rows).toHaveLength(120);
  });

  it.each([
    [0, 0],
    [99, 0],
    [100, 50],
    [150, 50],
    [151, 100],
    [200, 100],
    [201, 150],
    [250, 150],
    [251, 200],
    [300, 200],
  ])('length fee for %i ranks is $%i', (ranks, fee) => {
    expect(lengthFeeUsd(ranks)).toBe(fee);
  });

  it.each([
    [1, 0],
    [20, 0],
    [21, 30],
    [25, 150],
  ])('extra rank fee for %i unique codes is $%i', (codes, fee) => {
    expect(extraRankFeeUsd(codes)).toBe(fee);
  });

  it('fee estimate counts unique codes per partner (No Match included) and warns near a tier boundary', () => {
    const input = randomInput(7, 25, 25, { listLength: 300 });
    for (const k of [0, 1] as const) for (const e of input.lists[k]) e.acceptable = true;
    const { list } = runEngine(input);
    const rows = list.rows.slice(0, 152).map((r) => r.pair);
    const est = feeEstimate(rows);
    for (const k of [0, 1] as const) {
      const unique = new Set(rows.map((p) => p.programs[k])).size;
      expect(est.partners[k].uniqueCodes).toBe(unique);
      expect(est.partners[k].extraRankFeeUsd).toBe(Math.max(0, unique - 20) * 30);
      expect(est.partners[k].couplesFeeUsd).toBe(NRMP_RULES.couplesFeePerPartnerUsd);
    }
    expect(est.partners[0].lengthFeeUsd).toBe(100);
    expect(est.tierWarning).toEqual({ dropTo: 150, pairsToCut: 2, saveUsdPerPartner: 50 });
  });
});

describe('Explanations and manual moves', () => {
  it('explains a constraint-ordered pair with the chain of reasons', () => {
    const input = randomInput(5, 6, 6);
    const { list } = runEngine(input);
    const first = list.order[0];
    const nm = list.order.find((id) => id.includes(NO_MATCH))!;
    const reasons = explainOrder(list, nm, first);
    expect(reasons[0].kind).toBe('constraint');
  });

  it('a drag that breaks a hard edge is blocked with reasons; an allowed drag yields a pin', () => {
    const input = emptyInput({ tierARule: ['off', 'off'] });
    for (const id of ['a1', 'a2', 'b1', 'b2']) input.programs[id] = program(id, METROS[2]);
    input.lists = [list([['a1', 'B'], ['a2', 'B']]), list([['b1', 'B'], ['b2', 'B']])];
    const { list: ranked } = runEngine(input);
    const blocked = proposeMove(ranked, 'a2|b2', 'a1|b1');
    expect(blocked.ok).toBe(false);
    const allowed = proposeMove(ranked, 'a2|b1', 'a1|b2');
    expect(allowed).toEqual({ ok: true, pin: { higher: 'a2|b1', lower: 'a1|b2', source: 'manual_drag' } });
  });

  it('disagreements in separate mode are reported and not counted', () => {
    const input = randomInput(9, 5, 5);
    const pairs = buildCandidates(input).filter((p) => !isNoMatchPair(p));
    const [x, y] = [pairs[0].id, pairs[1].id];
    input.comparisons = [
      { id: 'c1', left: x, right: y, winner: 'left', answeredBy: 'u1', seq: 1 },
      { id: 'c2', left: y, right: x, winner: 'left', answeredBy: 'u2', seq: 2 },
    ];
    const g = buildConstraintGraph(buildCandidates(input), input);
    const conflicts = findConflicts(g, defaultPosterior(), input.comparisons);
    expect(conflicts.filter((c) => c.kind === 'disagreement')).toHaveLength(1);
  });
});

describe('Performance (informational for Phase 1)', () => {
  it('rebuilds ~300 candidate pairs in well under 50 ms', () => {
    const input = randomInput(11, 17, 17);
    for (const k of [0, 1] as const) for (const e of input.lists[k]) e.acceptable = true;
    runEngine(input); // warm up
    const t0 = performance.now();
    const runs = 10;
    for (let i = 0; i < runs; i++) runEngine(input);
    const ms = (performance.now() - t0) / runs;
    console.log(`full rebuild, ${buildCandidates(input).length} pairs: ${ms.toFixed(2)} ms`);
    expect(ms).toBeLessThan(50);
  });
});
