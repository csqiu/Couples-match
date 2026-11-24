/**
 * Simulated couples for the learning benchmark (spec test 7). Not exported from
 * the package entry point: it is a development tool.
 *
 * A simulated couple has hidden "true" model parameters. Their true list is what
 * the engine would produce if it knew those parameters exactly. They answer the
 * engine's questions by comparing true scores, and a fraction of answers are
 * flipped at random to model noise. We then measure how close the engine's list
 * gets to their true list.
 */
import { buildCandidates } from '../candidates';
import { withDefaults } from '../defaults';
import { pairFeatures, dot, paramsToTheta } from '../features';
import { buildConstraintGraph } from '../graph';
import { LATENT_DIM, fitModel, latentToParams, priorPosterior } from '../learning';
import { allOpenQuestions, nextQuestions } from '../questions';
import { rankPairs } from '../rank';
import { createRng } from '../rng';
import { defaultPosterior, scorePairs } from '../scoring';
import type { Comparison, CoupleSettings, EngineInput, ModelParams, PairId, ProgramInfo, RankEntry, Tier } from '../types';

const METROS = [
  { name: 'Boston', lat: 42.36, lon: -71.06, cbsa: '14460' },
  { name: 'New York', lat: 40.75, lon: -73.99, cbsa: '35620' },
  { name: 'Baltimore', lat: 39.29, lon: -76.61, cbsa: '12580' },
  { name: 'Washington', lat: 38.9, lon: -77.03, cbsa: '47900' },
  { name: 'Philadelphia', lat: 39.95, lon: -75.17, cbsa: '37980' },
  { name: 'Chicago', lat: 41.88, lon: -87.63, cbsa: '16980' },
  { name: 'San Francisco', lat: 37.77, lon: -122.42, cbsa: '41860' },
  { name: 'San Jose', lat: 37.34, lon: -121.89, cbsa: '41940' },
  { name: 'Houston', lat: 29.76, lon: -95.37, cbsa: '26420' },
] as const;

/** A realistic-looking couple: ~15 programs each spread over a handful of shared metros. */
export function simulatedInput(seed: number, perPartner = 15, settings: Partial<CoupleSettings> = {}): EngineInput {
  const rng = createRng(seed);
  // Each couple applies in a subset of metros (that's what makes "together" possible).
  const metros = [...METROS].sort(() => rng.next() - 0.5).slice(0, 6);
  const programs: Record<string, ProgramInfo> = {};
  const lists: [RankEntry[], RankEntry[]] = [[], []];
  for (const k of [0, 1] as const) {
    const nA = rng.int(1, 3);
    const nB = rng.int(5, 8);
    for (let i = 0; i < perPartner; i++) {
      const m = rng.pick(metros);
      const id = `p${k + 1}-${i}`;
      programs[id] = {
        id,
        name: `${m.name} ${k === 0 ? 'IM' : 'Peds'} ${i + 1}`,
        lat: m.lat + (rng.next() - 0.5) * 0.2,
        lon: m.lon + (rng.next() - 0.5) * 0.2,
        cbsaCode: m.cbsa,
      };
      const tier: Tier = i < nA ? 'A' : i < nA + nB ? 'B' : 'C';
      lists[k].push({ programId: id, rank: i + 1, tier, acceptable: true });
    }
  }
  return {
    programs,
    lists,
    settings: withDefaults({ tierAPriority: 'case_by_case', ...settings }),
    pins: [],
    exclusions: [],
    exceptions: [],
    comparisons: [],
    seed,
  };
}

/** Hidden parameters drawn from the prior. */
export function hiddenParams(seed: number): ModelParams {
  const rng = createRng(seed ^ 0x5bd1e995);
  return latentToParams(Array.from({ length: LATENT_DIM }, () => rng.normal()));
}

/** Kendall's tau between the true order and the engine's order, over the true top `k`. */
export function kendallTau(trueOrder: PairId[], position: Map<PairId, number>, k = 100): number {
  const items = trueOrder.slice(0, k);
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const d = position.get(items[i])! - position.get(items[j])!;
      if (d < 0) concordant++;
      else if (d > 0) discordant++;
    }
  }
  return concordant + discordant ? (concordant - discordant) / (concordant + discordant) : 1;
}

/**
 * Kendall's tau over the true top `k`, counting only the orderings that can change
 * where the couple matches: a pair of rows is left out when a swapped pair (see
 * isMootComparison) is above both in the true order.
 */
export function kendallTauRelevant(trueOrder: PairId[], position: Map<PairId, number>, k = 100): number {
  const truePos = new Map(trueOrder.map((id, i) => [id, i]));
  const items = trueOrder.slice(0, k);
  const sides = (id: PairId) => id.split('|');
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < items.length; i++) {
    const [a1, b1] = sides(items[i]);
    for (let j = i + 1; j < items.length; j++) {
      const [a2, b2] = sides(items[j]);
      if (a1 !== a2 && b1 !== b2) {
        const above = [`${a1}|${b2}`, `${a2}|${b1}`].some((c) => (truePos.get(c) ?? Infinity) < i);
        if (above) continue;
      }
      const d = position.get(items[i])! - position.get(items[j])!;
      if (d < 0) concordant++;
      else if (d > 0) discordant++;
    }
  }
  return concordant + discordant ? (concordant - discordant) / (concordant + discordant) : 1;
}

export interface SimulationOptions {
  strategy: 'active' | 'random';
  questions?: number;
  noise?: number;
  particles?: number;
  topK?: number;
}

export interface SimulationResult {
  tauBefore: number;
  tauAfter: number;
  tauByQuestion: number[];
  /** Same, counting only orderings that can change the outcome (kendallTauRelevant). */
  relevantBefore: number;
  relevantAfter: number;
  answered: number;
}

export function simulateCouple(input: EngineInput, truth: ModelParams, opts: SimulationOptions): SimulationResult {
  const { strategy, questions = 40, noise = 0.1, particles, topK = 100 } = opts;
  const rng = createRng(input.seed * 31 + (strategy === 'active' ? 1 : 2));
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  const byId = new Map(pairs.map((p) => [p.id, p]));

  const trueTheta = paramsToTheta(truth);
  const trueScore = (id: PairId) => {
    const f = pairFeatures(byId.get(id)!, input.settings);
    return dot(trueTheta, f.phi) + f.bonus;
  };
  const trueOrder = rankPairs(graph, scorePairs(pairs, defaultPosterior(truth), input.settings), { length: 10_000 }).order;

  const prior = priorPosterior(input.seed, particles);
  const comparisons: Comparison[] = [];
  const tauByQuestion: number[] = [];
  const relevant: number[] = [];
  const fit = () => fitModel(prior, comparisons, { pairs, settings: input.settings, seed: input.seed });

  for (let q = 0; q <= questions; q++) {
    const posterior = fit();
    const list = rankPairs(graph, scorePairs(pairs, posterior, input.settings), { length: 10_000 });
    tauByQuestion.push(kendallTau(trueOrder, list.position, topK));
    relevant.push(kendallTauRelevant(trueOrder, list.position, topK));
    if (q === questions) break;

    const pick =
      strategy === 'active'
        ? nextQuestions(list, posterior, 1, { comparisons })[0]
        : (() => {
            const open = allOpenQuestions(list, posterior, { comparisons });
            return open.length ? open[Math.floor(rng.next() * open.length)] : undefined;
          })();
    if (!pick) break;

    const diff = trueScore(pick.left) - trueScore(pick.right);
    let winner: Comparison['winner'] = diff >= 0 ? 'left' : 'right';
    if (rng.next() < noise) winner = winner === 'left' ? 'right' : 'left';
    comparisons.push({ id: `q${q + 1}`, left: pick.left, right: pick.right, winner, seq: q + 1 });
  }

  return {
    tauBefore: tauByQuestion[0],
    tauAfter: tauByQuestion[tauByQuestion.length - 1],
    tauByQuestion,
    relevantBefore: relevant[0],
    relevantAfter: relevant[relevant.length - 1],
    answered: comparisons.length,
  };
}
