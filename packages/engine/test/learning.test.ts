import { describe, expect, it } from 'vitest';
import {
  CALIBRATION_QUESTIONS,
  DEFAULT_PARAMS,
  LATENT_DIM,
  MAX_QUESTIONS,
  buildCandidates,
  buildConstraintGraph,
  certainAnswerPin,
  findConflicts,
  fitModel,
  hardClosure,
  hardOrdered,
  latentToParams,
  learningStatus,
  nextQuestions,
  posteriorMoments,
  priorPosterior,
  rankPairs,
  runEngine,
  scorePairs,
  T,
  type Comparison,
  type EngineInput,
} from '../src/index';
import { hiddenParams, simulateCouple, simulatedInput } from '../src/bench/simulate';

const PARTICLES_FOR_UNIT_TESTS = 500;

function setup(input: EngineInput, particles = PARTICLES_FOR_UNIT_TESTS) {
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  const prior = priorPosterior(input.seed, particles);
  return { pairs, graph, prior };
}

describe('Prior', () => {
  it('z = 0 maps exactly to the defaults', () => {
    const p = latentToParams(new Array(LATENT_DIM).fill(0));
    for (const k of [0, 1] as const) {
      for (const t of ['A', 'B', 'C'] as const) expect(p.base[k][t]).toBeCloseTo(DEFAULT_PARAMS.base[k][t], 12);
      expect(p.s[k]).toBeCloseTo(DEFAULT_PARAMS.s[k], 12);
    }
    expect(p.pen.commutable).toBeCloseTo(0.1, 12);
    expect(p.pen.drivable).toBeCloseTo(0.3, 12);
    expect(p.pen.apart).toBeCloseTo(0.6, 12);
    expect(p.vNM).toBeCloseTo(-0.8, 12);
  });

  it('every particle respects tier order, monotone distance penalties and No Match below Tier C', () => {
    const prior = priorPosterior(7, 2000);
    expect(prior.particles).toHaveLength(2000);
    for (const p of prior.particles) {
      for (const k of [0, 1] as const) {
        const b = p.base[k];
        expect(p.s[k]).toBeGreaterThan(0);
        expect(b.A).toBeGreaterThan(b.B + p.s[k]); // worst A beats best B
        expect(b.B).toBeGreaterThan(b.C + p.s[k]);
        expect(p.vNM).toBeLessThan(b.C);
      }
      expect(p.pen.commutable).toBeGreaterThan(0);
      expect(p.pen.drivable).toBeGreaterThanOrEqual(p.pen.commutable);
      expect(p.pen.apart).toBeGreaterThanOrEqual(p.pen.drivable);
    }
  });
});

describe('Fitting', () => {
  const input = simulatedInput(3);
  const { pairs, graph, prior } = setup(input);
  const together = pairs.filter((p) => p.band === 'together');
  const apart = pairs.filter((p) => p.band === 'apart');

  /** A couple who always prefers being together over being apart. */
  function distanceAverseAnswers(n: number): Comparison[] {
    const out: Comparison[] = [];
    for (let i = 0; i < n; i++) {
      const left = apart[(i * 7) % apart.length].id;
      const right = together[(i * 3) % together.length].id;
      out.push({ id: `c${i}`, left, right, winner: 'right', seq: i });
    }
    return out;
  }

  it('answers move the posterior: preferring "together" raises the Apart penalty', () => {
    const before = posteriorMoments(prior).mean[T.penApart];
    const post = fitModel(prior, distanceAverseAnswers(20), { pairs, settings: input.settings, seed: 1 });
    const after = posteriorMoments(post).mean[T.penApart];
    expect(after).toBeGreaterThan(before * 1.5);
    // Uncertainty is available "for free" and shrinks (relative to the estimate: the penalty is log-normal).
    const cv = (p: typeof prior) => {
      const m = posteriorMoments(p);
      return Math.sqrt(m.cov[T.penApart * 12 + T.penApart]) / m.mean[T.penApart];
    };
    expect(cv(post)).toBeLessThan(cv(prior));
  });

  it('is deterministic given the seed, and keeps particles diverse after resampling', () => {
    const answers = distanceAverseAnswers(25);
    const stats: Record<string, number> = {};
    const a = fitModel(prior, answers, { pairs, settings: input.settings, seed: 9 }, stats);
    const b = fitModel(prior, answers, { pairs, settings: input.settings, seed: 9 });
    expect(b).toEqual(a);
    expect(stats.resamples).toBeGreaterThan(0);
    expect(stats.acceptance).toBeGreaterThan(0.05);
    const distinct = new Set(a.particles.map((p) => p.pen.apart.toFixed(10))).size;
    expect(distinct).toBeGreaterThan(PARTICLES_FOR_UNIT_TESTS / 4);
  });

  it('ignores disagreements and comparisons about pairs that no longer exist', () => {
    const [x, y] = [together[0].id, apart[0].id];
    const comparisons: Comparison[] = [
      { id: 'a', left: x, right: y, winner: 'left', answeredBy: 'u1' },
      { id: 'b', left: x, right: y, winner: 'right', answeredBy: 'u2' },
      { id: 'c', left: 'gone|gone2', right: y, winner: 'left' },
    ];
    expect(fitModel(prior, comparisons, { pairs, settings: input.settings })).toBe(prior);
  });

  it('flags an answer the fitted model now strongly disagrees with', () => {
    const answers = distanceAverseAnswers(30);
    // The odd one out: an Apart pair that is worse for both partners than a Together pair, chosen anyway.
    const near = together.reduce((a, b) => (a.rank[0] + a.rank[1] <= b.rank[0] + b.rank[1] ? a : b));
    const far = apart
      .filter((p) => p.rank[0] >= near.rank[0] && p.rank[1] >= near.rank[1])
      .reduce((a, b) => (a.rank[0] + a.rank[1] >= b.rank[0] + b.rank[1] ? a : b));
    const odd = { id: 'odd', left: far.id, right: near.id, winner: 'left' as const, seq: 99 };
    const all = [...answers, odd];
    const post = fitModel(prior, all, { pairs, settings: input.settings, seed: 2 });
    const flagged = findConflicts(graph, post, all)
      .filter((c) => c.kind === 'surprising_answer')
      .map((c) => c.id);
    expect(flagged).toContain('surprise:odd');
    expect(flagged.length).toBeLessThan(answers.length / 4); // consistent answers mostly aren't flagged

    // Once the couple confirms it ("Still true? Yes" locks it), it isn't flagged again.
    const confirmed = [...answers, { ...odd, locked: true }];
    const again = findConflicts(graph, post, confirmed).map((c) => c.id);
    expect(again).not.toContain('surprise:odd');
  });
});

describe('Question selection', () => {
  const input = simulatedInput(5);
  const { pairs, graph, prior } = setup(input);
  const list = rankPairs(graph, scorePairs(pairs, prior, input.settings), { length: 10_000 });

  it('opens with calibration questions, most of which trade distance against quality', () => {
    const qs = nextQuestions(list, prior, CALIBRATION_QUESTIONS);
    expect(qs.length).toBeGreaterThanOrEqual(4);
    expect(qs.length).toBeLessThanOrEqual(6);
    expect(qs.every((q) => q.kind === 'calibration')).toBe(true);
    expect(qs.filter((q) => q.tradeoff).length).toBeGreaterThanOrEqual(3);
  });

  it('never asks about pairs the hard rules already order, or questions already answered', () => {
    const closure = hardClosure(graph);
    const asked: Comparison[] = [];
    for (let i = 0; i < 12; i++) {
      const [q] = nextQuestions(list, prior, 1, { comparisons: asked });
      expect(hardOrdered(closure, graph.index.get(q.left)!, graph.index.get(q.right)!)).toBe(false);
      expect(asked.some((c) => (c.left === q.left && c.right === q.right) || (c.left === q.right && c.right === q.left))).toBe(false);
      expect(Math.abs(list.position.get(q.left)! - list.position.get(q.right)!)).toBeLessThanOrEqual(40);
      asked.push({ id: `c${i}`, left: q.left, right: q.right, winner: 'left', seq: i });
    }
    const [after] = nextQuestions(list, prior, 1, { comparisons: asked });
    expect(after.kind).toBe('active');
  });

  it('ranks questions by uncertainty × impact (with boosts for trade-offs and tier clashes)', () => {
    const asked = Array.from({ length: CALIBRATION_QUESTIONS }, (_, i) => ({
      id: `x${i}`, left: `none${i}`, right: `none${i}b`, winner: 'left' as const,
    }));
    const qs = nextQuestions(list, prior, 10, { comparisons: asked });
    for (let i = 1; i < qs.length; i++) expect(qs[i - 1].value).toBeGreaterThanOrEqual(qs[i].value);
    for (const q of qs) expect(q.value).toBeCloseTo(q.uncertainty * q.impact * (q.tradeoff ? 1.5 : 1) * (q.clash ? 1.5 : 1), 10);
  });

  it('"I\'m certain" turns an answer into a pin', () => {
    expect(certainAnswerPin({ id: 'c7', left: 'a|b', right: 'c|d', winner: 'right' })).toEqual({
      higher: 'c|d', lower: 'a|b', source: 'comparison', comparisonId: 'c7',
    });
    expect(certainAnswerPin({ id: 'c8', left: 'a|b', right: 'c|d', winner: 'tie' })).toBeNull();
  });
});

describe('Stopping', () => {
  it('stops after 40 answers, and list confidence is a fraction', () => {
    const input = simulatedInput(8);
    const { pairs, graph, prior } = setup(input);
    const list = rankPairs(graph, scorePairs(pairs, prior, input.settings));
    const status = learningStatus(list, prior, []);
    expect(status.confidence).toBeGreaterThanOrEqual(0);
    expect(status.confidence).toBeLessThanOrEqual(1);
    const many = Array.from({ length: MAX_QUESTIONS }, (_, i) => ({
      id: `c${i}`, left: `l${i}`, right: `r${i}`, winner: 'left' as const,
    }));
    expect(learningStatus(list, prior, many).done).toBe(true);
  });

  it('list confidence rises as a simulated couple answers', () => {
    const input = simulatedInput(4);
    const truth = hiddenParams(4);
    const { pairs, graph, prior } = setup(input);
    const comparisons: Comparison[] = [];
    const confidence: number[] = [];
    let posterior = prior;
    for (let i = 0; i <= 20; i++) {
      const list = rankPairs(graph, scorePairs(pairs, posterior, input.settings));
      confidence.push(learningStatus(list, posterior, comparisons).confidence);
      const [q] = nextQuestions(list, posterior, 1, { comparisons });
      const s = scorePairs(pairs.filter((p) => p.id === q.left || p.id === q.right), { particles: [truth], weights: [1] }, input.settings);
      comparisons.push({ id: `c${i}`, left: q.left, right: q.right, winner: s.get(q.left)!.mean >= s.get(q.right)!.mean ? 'left' : 'right', seq: i });
      posterior = fitModel(prior, comparisons, { pairs, settings: input.settings, seed: input.seed });
    }
    expect(confidence[20]).toBeGreaterThan(confidence[0]);
  });
});

describe('7. Learning works (simulated couples, 40 questions, 10% noise)', () => {
  // Measured on the orderings that can change where the couple matches (kendallTauRelevant):
  // with the tier rules on, most of the rest of the top 100 is moot (DECISIONS.md #125).
  it('reaches relevant Kendall τ ≥ 0.9 over the top 100, and active selection beats random', { timeout: 300_000 }, () => {
    const couples = [1, 2, 3, 4, 5, 6];
    const active: number[] = [];
    const random: number[] = [];
    for (const seed of couples) {
      const input = simulatedInput(seed);
      const truth = hiddenParams(seed);
      active.push(simulateCouple(input, truth, { strategy: 'active' }).relevantAfter);
      random.push(simulateCouple(input, truth, { strategy: 'random' }).relevantAfter);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`relevant τ active ${active.map((t) => t.toFixed(3)).join(' ')} | mean ${mean(active).toFixed(3)}`);
    console.log(`relevant τ random ${random.map((t) => t.toFixed(3)).join(' ')} | mean ${mean(random).toFixed(3)}`);
    for (const t of active) expect(t).toBeGreaterThanOrEqual(0.9);
    expect(mean(active)).toBeGreaterThan(mean(random));
  });

  it('the Tier C rule makes the list more accurate for a couple whose preferences follow it', { timeout: 300_000 }, () => {
    const withRule: number[] = [];
    const without: number[] = [];
    for (const seed of [1, 2, 3]) {
      const input = simulatedInput(seed);
      const truth = hiddenParams(seed);
      withRule.push(simulateCouple(input, truth, { strategy: 'active', questions: 20 }).relevantAfter);
      without.push(simulateCouple(input, truth, { strategy: 'active', questions: 20, engineSettings: { tierCRule: [false, false] } }).relevantAfter);
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean(withRule)).toBeGreaterThan(mean(without));
  });
});

describe('8b. Determinism with answers', () => {
  it('same inputs, answers and seed give an identical fitted list', () => {
    const input = simulatedInput(11);
    const truth = hiddenParams(11);
    const pairs = buildCandidates(input).filter((p) => p.band !== 'no_match');
    input.comparisons = Array.from({ length: 15 }, (_, i) => {
      const [l, r] = [pairs[(i * 13) % pairs.length], pairs[(i * 29 + 5) % pairs.length]];
      const s = scorePairs([l, r], { particles: [truth], weights: [1] }, input.settings);
      return { id: `c${i}`, left: l.id, right: r.id, winner: s.get(l.id)!.mean >= s.get(r.id)!.mean ? 'left' : 'right', seq: i } as Comparison;
    });
    const a = runEngine(input);
    const b = runEngine(JSON.parse(JSON.stringify(input)));
    expect(b.list.order).toEqual(a.list.order);
    expect(b.posterior).toEqual(a.posterior);
  });
});

describe('9. Performance (300 candidate pairs, 2,000 particles)', () => {
  it('full rebuild < 50 ms and question selection < 100 ms', () => {
    const input = simulatedInput(21, 17); // 18 × 18 − 1 = 323 candidates
    const pairs = buildCandidates(input);
    expect(pairs.length).toBeGreaterThanOrEqual(300);
    const real = pairs.filter((p) => p.band !== 'no_match');
    input.comparisons = Array.from({ length: 40 }, (_, i) => ({
      id: `c${i}`, left: real[(i * 37) % real.length].id, right: real[(i * 53 + 11) % real.length].id,
      winner: i % 3 ? 'left' : 'right', seq: i,
    }));

    const t0 = performance.now();
    const posterior = fitModel(priorPosterior(input.seed), input.comparisons, { pairs, settings: input.settings, seed: input.seed });
    const fitMs = performance.now() - t0;

    const time = (fn: () => void, runs = 10) => {
      fn();
      const s = performance.now();
      for (let i = 0; i < runs; i++) fn();
      return (performance.now() - s) / runs;
    };
    let list = runEngine(input, posterior).list;
    const rebuildMs = time(() => {
      const g = buildConstraintGraph(buildCandidates(input), input);
      findConflicts(g, posterior, input.comparisons);
      list = rankPairs(g, scorePairs(g.pairs, posterior, input.settings));
    });
    const questionMs = time(() => nextQuestions(list, posterior, 3, { comparisons: input.comparisons }));
    console.log(
      `${pairs.length} pairs: rebuild ${rebuildMs.toFixed(1)} ms, questions ${questionMs.toFixed(1)} ms, fit (40 answers) ${fitMs.toFixed(0)} ms`,
    );
    expect(rebuildMs).toBeLessThan(50);
    expect(questionMs).toBeLessThan(100);
  });
});
