/**
 * Learning the couple's trade-offs from their answers (Section 5.3, "Fitting").
 *
 * - Each answer is a Bradley–Terry observation: P(left preferred) = σ(β · (S_left − S_right)).
 * - The posterior over the 12 model parameters is a weighted particle set
 *   (≈2,000 samples), reweighted after each answer and resampled when the
 *   effective sample size drops below half. After a resample, each particle
 *   takes a few Metropolis steps against all answers so far (a standard
 *   "resample-move" step) to keep the particles diverse.
 * - Particles live in an unconstrained latent space z ~ N(0, I). The transform
 *   to parameters guarantees the model's built-in assumptions for every particle:
 *     tier A > tier B > tier C (with no overlap within a tier's spread),
 *     0 ≤ pen(commutable) ≤ pen(drivable) ≤ pen(apart),
 *     v_NM below every Tier C value.
 *   z = 0 maps exactly to DEFAULT_PARAMS, so the prior is centered on the defaults.
 */
import { effectiveComparisons } from './conflicts.js';
import { BT_BETA, DEFAULT_PARAMS, DEFAULT_SETTINGS, MH_STEP_SD, MH_STEPS, PARTICLE_COUNT, PRIOR_LOG_SD } from './defaults.js';
import { THETA_DIM, dot, pairFeatures, paramsToTheta, thetaToParams } from './features.js';
export { posteriorMoments, type PosteriorMoments } from './posterior.js';
import { createRng, type Rng } from './rng.js';
import type { Comparison, CoupleSettings, ModelParams, Pair, PairId, Posterior } from './types.js';

export const LATENT_DIM = 12;

/** Prior centers derived from the defaults, so z = 0 reproduces DEFAULT_PARAMS exactly. */
function centers(d: ModelParams = DEFAULT_PARAMS) {
  return {
    s: d.s,
    C: [d.base[0].C, d.base[1].C],
    gapBC: [d.base[0].B - d.base[0].C - d.s[0], d.base[1].B - d.base[1].C - d.s[1]],
    gapAB: [d.base[0].A - d.base[0].B - d.s[0], d.base[1].A - d.base[1].B - d.s[1]],
    pen: [d.pen.commutable, d.pen.drivable - d.pen.commutable, d.pen.apart - d.pen.drivable],
    nmGap: Math.min(d.base[0].C, d.base[1].C) - d.vNM,
  };
}
const C0 = centers();

/** Maps a latent vector to θ (see features.ts for the layout). */
export function latentToTheta(z: ArrayLike<number>, out = new Float64Array(THETA_DIM)): Float64Array {
  const sd = PRIOR_LOG_SD;
  let minC = Infinity;
  for (const k of [0, 1] as const) {
    const o = k * 4;
    const s = C0.s[k] * Math.exp(sd.s * z[o]);
    const c = C0.C[k] + sd.cLevel * z[o + 1];
    const b = c + s + C0.gapBC[k] * Math.exp(sd.gap * z[o + 2]);
    const a = b + s + C0.gapAB[k] * Math.exp(sd.gap * z[o + 3]);
    out[o] = a;
    out[o + 1] = b;
    out[o + 2] = c;
    out[o + 3] = s;
    minC = Math.min(minC, c);
  }
  const pc = C0.pen[0] * Math.exp(sd.pen * z[8]);
  const pd = pc + C0.pen[1] * Math.exp(sd.pen * z[9]);
  const pa = pd + C0.pen[2] * Math.exp(sd.pen * z[10]);
  out[8] = pc;
  out[9] = pd;
  out[10] = pa;
  out[11] = minC - C0.nmGap * Math.exp(sd.nm * z[11]);
  return out;
}

export function latentToParams(z: ArrayLike<number>): ModelParams {
  return thetaToParams(latentToTheta(z));
}

/** Prior sample: `count` particles with equal weights. Deterministic given the seed. */
export function priorPosterior(seed = 1, count = PARTICLE_COUNT): Posterior {
  const rng = createRng(seed);
  const latents: number[][] = [];
  const particles: ModelParams[] = [];
  for (let i = 0; i < count; i++) {
    const z = Array.from({ length: LATENT_DIM }, () => rng.normal());
    latents.push(z);
    particles.push(latentToParams(z));
  }
  return { particles, weights: new Array(count).fill(1 / count), latents };
}

// ---------------------------------------------------------------------------
// Observations

export interface Observation {
  comparisonId: string;
  /** φ(winner) − φ(loser), or φ(left) − φ(right) for a tie. */
  dphi: Float64Array;
  dbonus: number;
  tie: boolean;
}

export interface FitContext {
  pairs: Pair[];
  settings?: CoupleSettings;
  /** Seed for resampling and Metropolis moves. */
  seed?: number;
}

function featureLookup(pairs: Pair[], settings: CoupleSettings) {
  const byId = new Map(pairs.map((p) => [p.id, p]));
  const cache = new Map<PairId, ReturnType<typeof pairFeatures>>();
  return (id: PairId) => {
    let f = cache.get(id);
    if (!f) {
      const p = byId.get(id);
      if (!p) return null;
      f = pairFeatures(p, settings);
      cache.set(id, f);
    }
    return f;
  };
}

/**
 * Turns the comparisons that count (disagreements excluded) into observations,
 * in answer order. Comparisons naming pairs that are no longer candidates are skipped.
 */
export function toObservations(comparisons: Comparison[], ctx: FitContext): Observation[] {
  const settings = ctx.settings ?? DEFAULT_SETTINGS;
  const features = featureLookup(ctx.pairs, settings);
  const { counted } = effectiveComparisons(comparisons);
  const order = new Map(comparisons.map((c, i) => [c, i]));
  counted.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0) || order.get(a)! - order.get(b)!);
  const obs: Observation[] = [];
  for (const c of counted) {
    const [w, l] = c.winner === 'right' ? [c.right, c.left] : [c.left, c.right];
    const fw = features(w);
    const fl = features(l);
    if (!fw || !fl) continue;
    const dphi = new Float64Array(THETA_DIM);
    for (let i = 0; i < THETA_DIM; i++) dphi[i] = fw.phi[i] - fl.phi[i];
    obs.push({ comparisonId: c.id, dphi, dbonus: fw.bonus - fl.bonus, tie: c.winner === 'tie' });
  }
  return obs;
}

function logSigmoid(x: number): number {
  return x >= 0 ? -Math.log1p(Math.exp(-x)) : x - Math.log1p(Math.exp(x));
}

/** Log-likelihood of one observation. A tie is most likely when the scores are equal. */
export function obsLogLik(theta: ArrayLike<number>, o: Observation, beta = BT_BETA): number {
  const x = beta * (dot(theta, o.dphi) + o.dbonus);
  return o.tie ? Math.log(4) + logSigmoid(x) + logSigmoid(-x) : logSigmoid(x);
}

function logPosterior(z: ArrayLike<number>, theta: Float64Array, obs: Observation[], upto: number): number {
  let lp = 0;
  for (let i = 0; i < LATENT_DIM; i++) lp -= 0.5 * z[i] * z[i];
  for (let t = 0; t <= upto; t++) lp += obsLogLik(theta, obs[t]);
  return lp;
}

function systematicResample(weights: Float64Array, rng: Rng): Int32Array {
  const n = weights.length;
  const idx = new Int32Array(n);
  const u0 = rng.next() / n;
  let c = weights[0];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const u = u0 + i / n;
    while (u > c && j < n - 1) c += weights[++j];
    idx[i] = j;
  }
  return idx;
}

export interface FitStats {
  resamples: number;
  acceptance: number;
  ess: number;
}

/**
 * Fits the posterior to the couple's answers, starting from `prior` (normally
 * `priorPosterior(input.seed)`). Pure and deterministic given the seed.
 */
export function fitModel(
  prior: Posterior,
  comparisons: Comparison[],
  ctx: FitContext,
  stats?: Partial<FitStats>,
): Posterior {
  const obs = toObservations(comparisons, ctx);
  if (!obs.length) return prior;
  const rng = createRng((ctx.seed ?? 1) * 2654435761 + obs.length);
  const n = prior.particles.length;

  let latents: Float64Array[] | null = prior.latents ? prior.latents.map((z) => Float64Array.from(z)) : null;
  let thetas: Float64Array[] = latents ? latents.map((z) => latentToTheta(z)) : prior.particles.map(paramsToTheta);
  const total = prior.weights.reduce((a, b) => a + b, 0) || 1;
  const logw = Float64Array.from(prior.weights, (w) => Math.log(w / total));
  const w = new Float64Array(n);
  let resamples = 0;
  let accepted = 0;
  let proposed = 0;
  let ess = n;

  const normalize = () => {
    let max = -Infinity;
    for (let i = 0; i < n; i++) max = Math.max(max, logw[i]);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += w[i] = Math.exp(logw[i] - max);
    let sq = 0;
    for (let i = 0; i < n; i++) {
      w[i] /= sum;
      sq += w[i] * w[i];
    }
    ess = 1 / sq;
  };

  for (let t = 0; t < obs.length; t++) {
    for (let i = 0; i < n; i++) logw[i] += obsLogLik(thetas[i], obs[t]);
    normalize();
    if (ess >= n / 2) continue;

    // Resample …
    resamples++;
    const idx = systematicResample(w, rng);
    thetas = Array.from(idx, (j) => Float64Array.from(thetas[j]));
    if (latents) latents = Array.from(idx, (j) => Float64Array.from(latents![j]));
    logw.fill(-Math.log(n));

    // … and move (only possible when we know each particle's latent position).
    if (!latents) continue;
    const prop = new Float64Array(LATENT_DIM);
    const propTheta = new Float64Array(THETA_DIM);
    for (let i = 0; i < n; i++) {
      const z = latents[i];
      let cur = logPosterior(z, thetas[i], obs, t);
      for (let step = 0; step < MH_STEPS; step++) {
        for (let d = 0; d < LATENT_DIM; d++) prop[d] = z[d] + MH_STEP_SD * rng.normal();
        latentToTheta(prop, propTheta);
        const next = logPosterior(prop, propTheta, obs, t);
        proposed++;
        if (Math.log(rng.next()) < next - cur) {
          z.set(prop);
          thetas[i].set(propTheta);
          cur = next;
          accepted++;
        }
      }
    }
  }
  normalize();

  if (stats) {
    stats.resamples = resamples;
    stats.acceptance = proposed ? accepted / proposed : 0;
    stats.ess = ess;
  }
  return {
    particles: thetas.map(thetaToParams),
    weights: Array.from(w),
    ...(latents ? { latents: latents.map((z) => Array.from(z)) } : {}),
  };
}
