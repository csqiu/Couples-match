/**
 * Choosing the next comparison (Section 5.6) and knowing when to stop.
 */
import { stronglyConnected } from './conflicts.js';
import {
  CALIBRATION_QUESTIONS,
  IMPACT_FOCUS_TOP,
  IMPACT_TAIL_WEIGHT,
  CALIBRATION_SEARCH_DEPTHS,
  MAX_QUESTIONS,
  QUESTION_WINDOW,
  STOP_ADJACENT_FRACTION,
  STOP_ORDER_CONFIDENCE,
  STOP_TOP,
  TRADEOFF_BOOST,
} from './defaults.js';
import { THETA_DIM, pairFeatures, type PairFeatures } from './features.js';
import { isHub, type Graph } from './graph.js';
import { linearMoments, orderConfidence, posteriorMoments, predictiveApprox, type PosteriorMoments } from './posterior.js';
import type { RankedList } from './rank.js';
import { effectiveComparisons } from './conflicts.js';
import type { Band, Comparison, Pair, PairId, Pin, Posterior } from './types.js';

// ---------------------------------------------------------------------------
// Reachability in the hard graph

export interface Closure {
  words: number;
  /** reach[u] has bit v set when pair u must rank above pair v. */
  reach: Uint32Array[];
}

const closureCache = new WeakMap<Graph, Closure>();

/** Transitive closure over real pairs (edges inside unresolved cycles are ignored, as in ranking). */
export function hardClosure(g: Graph): Closure {
  const cached = closureCache.get(g);
  if (cached) return cached;
  const { compOf, comps } = stronglyConnected(g);
  const cyclic = comps.some((c) => c.length > 1);
  const ignore = (u: number, v: number) => cyclic && compOf[u] === compOf[v];

  // Topological order of all nodes (hubs included).
  const indeg = new Int32Array(g.size);
  for (let u = 0; u < g.size; u++) for (const v of g.out[u]) if (!ignore(u, v)) indeg[v]++;
  const topo: number[] = [];
  for (let u = 0; u < g.size; u++) if (indeg[u] === 0) topo.push(u);
  for (let i = 0; i < topo.length; i++) {
    for (const v of g.out[topo[i]]) if (!ignore(topo[i], v) && --indeg[v] === 0) topo.push(v);
  }

  const words = Math.ceil(g.n / 32);
  const reach = Array.from({ length: g.size }, () => new Uint32Array(words));
  for (let i = topo.length - 1; i >= 0; i--) {
    const u = topo[i];
    const ru = reach[u];
    for (const v of g.out[u]) {
      if (ignore(u, v)) continue;
      if (!isHub(g, v)) ru[v >>> 5] |= 1 << (v & 31);
      const rv = reach[v];
      for (let w = 0; w < words; w++) ru[w] |= rv[w];
    }
  }
  const c = { words, reach };
  closureCache.set(g, c);
  return c;
}

export function mustRankAbove(c: Closure, u: number, v: number): boolean {
  return (c.reach[u][v >>> 5] & (1 << (v & 31))) !== 0;
}

export function hardOrdered(c: Closure, u: number, v: number): boolean {
  return mustRankAbove(c, u, v) || mustRankAbove(c, v, u);
}

// ---------------------------------------------------------------------------
// Questions

export interface Question {
  /** Currently higher in the list. */
  left: PairId;
  right: PairId;
  /** Posterior-predictive probability the couple prefers `left`. */
  pLeft: number;
  /** 1 − |2p − 1| with p = posterior probability that `left` truly scores higher. */
  uncertainty: number;
  /** Weighted number of list positions that would change if the order flipped. */
  impact: number;
  /** True when one pair is closer together and the other is better for at least one partner. */
  tradeoff: boolean;
  value: number;
  kind: 'calibration' | 'active';
}

export interface QuestionOptions {
  /** Answers so far (to skip questions already asked and to decide on calibration). */
  comparisons?: Comparison[];
  window?: number;
}

const BAND_ORDER: Record<Band, number> = { together: 0, commutable: 1, drivable: 2, apart: 3, no_match: 4 };

function questionKey(a: PairId, b: PairId): string {
  return a < b ? `${a}#${b}` : `${b}#${a}`;
}

/** One pair is closer together while the other gives at least one partner a better program. */
export function isTradeoff(x: Pair, y: Pair): boolean {
  const bx = BAND_ORDER[x.band];
  const by = BAND_ORDER[y.band];
  if (bx === by || x.band === 'no_match' || y.band === 'no_match') return false;
  const [near, far] = bx < by ? [x, y] : [y, x];
  return far.rank[0] < near.rank[0] || far.rank[1] < near.rank[1];
}

interface Ctx {
  g: Graph;
  closure: Closure;
  moments: PosteriorMoments;
  features: PairFeatures[];
  position: Int32Array;
  impactPrefix: Float64Array;
  asked: Set<string>;
}

function makeCtx(list: RankedList, posterior: Posterior, comparisons: Comparison[]): Ctx {
  const g = list.graph;
  const position = new Int32Array(g.n);
  list.order.forEach((id, i) => (position[g.index.get(id)!] = i));
  const impactPrefix = new Float64Array(list.order.length + 1);
  for (let i = 0; i < list.order.length; i++) {
    impactPrefix[i + 1] = impactPrefix[i] + (i < IMPACT_FOCUS_TOP ? 1 : IMPACT_TAIL_WEIGHT);
  }
  return {
    g,
    closure: hardClosure(g),
    moments: posteriorMoments(posterior),
    features: g.pairs.map((p) => pairFeatures(p, g.settings)),
    position,
    impactPrefix,
    asked: new Set(comparisons.map((c) => questionKey(c.left, c.right))),
  };
}

const diff = new Float64Array(THETA_DIM);

function evaluate(ctx: Ctx, u: number, v: number, kind: Question['kind']): Question {
  // Orient so `left` is the one currently higher.
  if (ctx.position[u] > ctx.position[v]) [u, v] = [v, u];
  const fu = ctx.features[u];
  const fv = ctx.features[v];
  for (let i = 0; i < THETA_DIM; i++) diff[i] = fu.phi[i] - fv.phi[i];
  const { mean, variance } = linearMoments(ctx.moments, diff, fu.bonus - fv.bonus);
  // Display probability: what the couple is predicted to answer (includes answer noise).
  const pLeft = predictiveApprox(mean, variance);
  // Selection uses how sure the model is of the *order* itself (parameter uncertainty only):
  // two pairs the model is confident are near-equal teach it little. See DECISIONS.md.
  const uncertainty = 1 - Math.abs(2 * orderConfidence(mean, variance) - 1);
  const impact = ctx.impactPrefix[ctx.position[v] + 1] - ctx.impactPrefix[ctx.position[u]];
  const tradeoff = isTradeoff(ctx.g.pairs[u], ctx.g.pairs[v]);
  return {
    left: ctx.g.pairs[u].id,
    right: ctx.g.pairs[v].id,
    pLeft,
    uncertainty,
    impact,
    tradeoff,
    value: uncertainty * impact * (tradeoff ? TRADEOFF_BOOST : 1),
    kind,
  };
}

/** Every open question: pairs not ordered by the hard graph, within `window` positions, not yet asked. */
function openQuestions(list: RankedList, ctx: Ctx, window: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const order = list.order.map((id) => ctx.g.index.get(id)!);
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j <= i + window && j < order.length; j++) {
      const u = order[i];
      const v = order[j];
      if (hardOrdered(ctx.closure, u, v)) continue;
      if (ctx.asked.has(questionKey(ctx.g.pairs[u].id, ctx.g.pairs[v].id))) continue;
      out.push([u, v]);
    }
  }
  return out;
}

const byValue = (a: Question, b: Question) =>
  b.value - a.value || a.left.localeCompare(b.left) || a.right.localeCompare(b.right);

/**
 * Templated opening questions that calibrate distance against program quality:
 * for each (farther band, closer band) template, the open question where the
 * farther pair is better for someone and the model is least sure. Plus one
 * question that trades one partner's program against the other's at the same distance.
 */
export function calibrationQuestions(list: RankedList, posterior: Posterior, opts: QuestionOptions = {}): Question[] {
  const ctx = makeCtx(list, posterior, opts.comparisons ?? []);
  const g = ctx.g;
  const templates: Array<[Band, Band] | 'partners'> = [
    ['apart', 'together'],
    ['drivable', 'together'],
    ['commutable', 'together'],
    ['apart', 'commutable'],
    'partners',
    ['apart', 'drivable'],
  ];
  // Calibrate near the top of the list, where it matters: search the top 30 positions
  // first and widen only if a template finds nothing there.
  const all = openQuestions(list, ctx, Math.max(opts.window ?? QUESTION_WINDOW, 40));
  const pools = CALIBRATION_SEARCH_DEPTHS.map((depth) =>
    all.filter(([u, v]) => ctx.position[u] < depth && ctx.position[v] < depth),
  );
  const used = new Set<number>();
  const out: Question[] = [];
  const fitsTemplate = (t: (typeof templates)[number], u: number, v: number) => {
    const pu = g.pairs[u];
    const pv = g.pairs[v];
    if (t === 'partners') {
      return (
        pu.band === pv.band &&
        pu.band !== 'no_match' &&
        Math.sign(pu.rank[0] - pv.rank[0]) * Math.sign(pu.rank[1] - pv.rank[1]) < 0
      );
    }
    const [far, near] = t;
    const [f, n] = pu.band === far && pv.band === near ? [pu, pv] : pv.band === far && pu.band === near ? [pv, pu] : [null, null];
    return !!f && !!n && (f.rank[0] < n.rank[0] || f.rank[1] < n.rank[1]);
  };
  for (const t of templates) {
    if (out.length >= CALIBRATION_QUESTIONS) break;
    for (const pool of pools) {
      let best: Question | null = null;
      let bestU = -1;
      let bestV = -1;
      for (const [u, v] of pool) {
        if (used.has(u) || used.has(v) || !fitsTemplate(t, u, v)) continue;
        const q = evaluate(ctx, u, v, 'calibration');
        // Most uncertain wins; ties go to the question higher in the list (pool order).
        if (!best || q.uncertainty > best.uncertainty + 1e-9) {
          best = q;
          bestU = u;
          bestV = v;
        }
      }
      if (best) {
        out.push(best);
        used.add(bestU);
        used.add(bestV);
        break;
      }
    }
  }
  return out;
}

/**
 * The k most useful next questions. While fewer than CALIBRATION_QUESTIONS
 * answers count, unanswered calibration questions come first.
 */
export function nextQuestions(list: RankedList, posterior: Posterior, k = 1, opts: QuestionOptions = {}): Question[] {
  const comparisons = opts.comparisons ?? [];
  const answered = effectiveComparisons(comparisons).counted.length;
  const out: Question[] = [];
  const seen = new Set<string>();
  if (answered < CALIBRATION_QUESTIONS) {
    for (const q of calibrationQuestions(list, posterior, opts).slice(0, CALIBRATION_QUESTIONS - answered)) {
      if (out.length >= k) break;
      out.push(q);
      seen.add(questionKey(q.left, q.right));
    }
  }
  if (out.length >= k) return out;

  const ctx = makeCtx(list, posterior, comparisons);
  const candidates = openQuestions(list, ctx, opts.window ?? QUESTION_WINDOW)
    .map(([u, v]) => evaluate(ctx, u, v, 'active'))
    .filter((q) => !seen.has(questionKey(q.left, q.right)))
    .sort(byValue);
  for (const q of candidates) {
    if (out.length >= k) break;
    out.push(q);
  }
  return out;
}

/** Every open question (unordered by the hard graph, within the window, not yet asked). Used for baselines. */
export function allOpenQuestions(list: RankedList, posterior: Posterior, opts: QuestionOptions = {}): Question[] {
  const ctx = makeCtx(list, posterior, opts.comparisons ?? []);
  return openQuestions(list, ctx, opts.window ?? QUESTION_WINDOW).map(([u, v]) => evaluate(ctx, u, v, 'active'));
}

// ---------------------------------------------------------------------------
// Stopping

export interface LearningStatus {
  /** Fraction of adjacent rows in the top of the list whose order the model is ≥ 90% sure of. Shown as "list confidence". */
  confidence: number;
  answered: number;
  /** True when it is reasonable to stop suggesting questions (the couple may continue). */
  done: boolean;
}

export function learningStatus(list: RankedList, posterior: Posterior, comparisons: Comparison[] = []): LearningStatus {
  const g = list.graph;
  const closure = hardClosure(g);
  const m = posteriorMoments(posterior);
  const top = Math.min(STOP_TOP, list.order.length);
  let sure = 0;
  let total = 0;
  for (let i = 0; i + 1 < top; i++) {
    const u = g.index.get(list.order[i])!;
    const v = g.index.get(list.order[i + 1])!;
    total++;
    if (mustRankAbove(closure, u, v)) {
      sure++;
      continue;
    }
    const fu = pairFeatures(g.pairs[u], g.settings);
    const fv = pairFeatures(g.pairs[v], g.settings);
    for (let d = 0; d < THETA_DIM; d++) diff[d] = fu.phi[d] - fv.phi[d];
    const { mean, variance } = linearMoments(m, diff, fu.bonus - fv.bonus);
    if (orderConfidence(mean, variance) >= STOP_ORDER_CONFIDENCE) sure++;
  }
  const confidence = total ? sure / total : 1;
  const answered = effectiveComparisons(comparisons).counted.length;
  return { confidence, answered, done: confidence >= STOP_ADJACENT_FRACTION || answered >= MAX_QUESTIONS };
}

/** The pin to save when the couple answers with "I'm certain" on. */
export function certainAnswerPin(c: Comparison): Pin | null {
  if (c.winner === 'tie') return null;
  const [higher, lower] = c.winner === 'left' ? [c.left, c.right] : [c.right, c.left];
  return { higher, lower, source: 'comparison', comparisonId: c.id };
}
