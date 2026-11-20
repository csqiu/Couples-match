/**
 * Posterior summaries. Because S = θ·φ + bonus, a pair's score mean is mean(θ)·φ
 * and its variance is φᵀ Σ φ, so these never need to loop over particles per pair.
 */
import { BT_BETA } from './defaults';
import { THETA_DIM, dot, paramsToTheta, quadForm } from './features';
import type { Posterior } from './types';

export interface PosteriorMoments {
  thetas: Float64Array[];
  /** Normalized weights. */
  weights: Float64Array;
  mean: Float64Array;
  /** Row-major THETA_DIM × THETA_DIM covariance. */
  cov: Float64Array;
}

const momentCache = new WeakMap<Posterior, PosteriorMoments>();

export function posteriorMoments(posterior: Posterior): PosteriorMoments {
  const cached = momentCache.get(posterior);
  if (cached) return cached;
  const n = posterior.particles.length;
  const thetas = posterior.particles.map(paramsToTheta);
  const total = posterior.weights.reduce((a, b) => a + b, 0) || 1;
  const weights = Float64Array.from(posterior.weights, (w) => w / total);
  const mean = new Float64Array(THETA_DIM);
  for (let p = 0; p < n; p++) for (let i = 0; i < THETA_DIM; i++) mean[i] += weights[p] * thetas[p][i];
  const cov = new Float64Array(THETA_DIM * THETA_DIM);
  const d = new Float64Array(THETA_DIM);
  for (let p = 0; p < n; p++) {
    const w = weights[p];
    if (w === 0) continue;
    for (let i = 0; i < THETA_DIM; i++) d[i] = thetas[p][i] - mean[i];
    for (let i = 0; i < THETA_DIM; i++) for (let j = 0; j < THETA_DIM; j++) cov[i * THETA_DIM + j] += w * d[i] * d[j];
  }
  const m = { thetas, weights, mean, cov };
  momentCache.set(posterior, m);
  return m;
}


/** Mean and variance of θ·x under the posterior. */
export function linearMoments(m: PosteriorMoments, x: ArrayLike<number>, offset = 0): { mean: number; variance: number } {
  return { mean: dot(m.mean, x) + offset, variance: Math.max(0, quadForm(m.cov, x)) };
}

/** Exact posterior-predictive P(answer favours the side with feature difference x), averaging σ(β·d) over particles. */
export function predictiveExact(m: PosteriorMoments, x: ArrayLike<number>, offset = 0, beta = BT_BETA): number {
  let p = 0;
  for (let i = 0; i < m.thetas.length; i++) {
    const w = m.weights[i];
    if (w === 0) continue;
    p += w / (1 + Math.exp(-beta * (dot(m.thetas[i], x) + offset)));
  }
  return p;
}

/** Fast approximation of the predictive (probit approximation of a logistic-normal). */
export function predictiveApprox(mean: number, variance: number, beta = BT_BETA): number {
  return 1 / (1 + Math.exp((-beta * mean) / Math.sqrt(1 + (Math.PI * beta * beta * variance) / 8)));
}

/** P(true score difference > 0) under the posterior, normal approximation. */
export function orderConfidence(mean: number, variance: number): number {
  if (variance <= 1e-18) return mean > 0 ? 1 : mean < 0 ? 0 : 0.5;
  return normalCdf(mean / Math.sqrt(variance));
}

export function normalCdf(x: number): number {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
