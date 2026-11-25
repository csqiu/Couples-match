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
import { buildCandidates, splitPairId } from '../candidates';
import { mootWitnesses } from '../equivalence';
import { PRIOR_LOG_SD, withDefaults } from '../defaults';
import { buildLayout, pairFeatures, dot, paramsToTheta } from '../features';
import { buildConstraintGraph } from '../graph';
import { LATENT_DIM, fitModel, latentDim, latentToParams, priorPosterior } from '../learning';
import { allOpenQuestions, nextQuestions } from '../questions';
import { rankPairs } from '../rank';
import { createRng } from '../rng';
import { scorePairs } from '../scoring';
import type { Comparison, CoupleSettings, EngineInput, ModelLayout, ModelParams, PairId, ProgramInfo, RankEntry, Tier } from '../types';

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

/** Log-sd of the hidden couples' gaps between neighbouring programs, whatever the model assumes. */
export const TRUE_SPACING_LOG_SD = 0.8;

/**
 * Hidden parameters drawn from the prior. With a layout, the couple's true program
 * values are unevenly spaced within each tier (log-sd TRUE_SPACING_LOG_SD per gap).
 */
export function hiddenParams(seed: number, layout?: ModelLayout): ModelParams {
  const rng = createRng(seed ^ 0x5bd1e995);
  const extra = createRng(seed ^ 0x68e31da4);
  const z = Array.from({ length: LATENT_DIM }, () => rng.normal());
  const scale = TRUE_SPACING_LOG_SD / PRIOR_LOG_SD.spacing;
  for (let d = LATENT_DIM; d < latentDim(layout); d++) z.push(scale * extra.normal());
  return latentToParams(z, layout);
}

/** The layout simulateCouple uses for an input (for drawing uneven hidden values). */
export function simulatedLayout(input: EngineInput): ModelLayout {
  return buildLayout(buildCandidates(input));
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
 * where the couple matches: a pair of rows is left out when a pair from their box (see
 * mootWitnesses) is above both in the true order.
 */
export function kendallTauRelevant(trueOrder: PairId[], position: Map<PairId, number>, k = 100): number {
  const truePos = new Map(trueOrder.map((id, i) => [id, i]));
  const items = trueOrder.slice(0, k);
  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < items.length; i++) {
    const x = splitPairId(items[i]);
    for (let j = i + 1; j < items.length; j++) {
      // i < j, so a witness above row i is above both.
      if (mootWitnesses(x, splitPairId(items[j])).some((c) => (truePos.get(c) ?? Infinity) < i)) continue;
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
  /** true = the model also learns a value per program (off in the app; DECISIONS.md #119). */
  perProgram?: boolean;
  /**
   * Settings the engine uses, when different from the couple's true ones (input.settings,
   * which build the true order). For comparing rule sets against the same hidden couple.
   */
  engineSettings?: Partial<CoupleSettings>;
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
  const { strategy, questions = 40, noise = 0.1, particles, topK = 100, perProgram = false } = opts;
  const rng = createRng(input.seed * 31 + (strategy === 'active' ? 1 : 2));
  const pairs = buildCandidates(input);
  const graph = buildConstraintGraph(pairs, input);
  const engineInput: EngineInput = opts.engineSettings ? { ...input, settings: { ...input.settings, ...opts.engineSettings } } : input;
  const byId = new Map(pairs.map((p) => [p.id, p]));
  const layout = buildLayout(pairs);

  const trueTheta = paramsToTheta(truth, layout);
  const trueScore = (id: PairId) => {
    const f = pairFeatures(byId.get(id)!, input.settings, layout);
    return dot(trueTheta, f.phi) + f.bonus;
  };
  const truePosterior = { particles: [truth], weights: [1], layout };
  const trueOrder = rankPairs(graph, scorePairs(pairs, truePosterior, input.settings), { length: 10_000 }).order;

  const prior = priorPosterior(input.seed, particles, perProgram ? layout : undefined);
  const comparisons: Comparison[] = [];
  const tauByQuestion: number[] = [];
  const relevant: number[] = [];
  const fit = () => fitModel(prior, comparisons, { pairs, settings: engineInput.settings, seed: input.seed });

  for (let q = 0; q <= questions; q++) {
    const posterior = fit();
    // As in the app, every answer so far holds in the list (answers are hard rules).
    const answered = buildConstraintGraph(pairs, { ...engineInput, comparisons });
    const list = rankPairs(answered, scorePairs(pairs, posterior, engineInput.settings), { length: 10_000 });
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
