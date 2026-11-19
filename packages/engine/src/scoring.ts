/**
 * Soft layer (Section 5.3): each partner's value for a program, the pair score,
 * and posterior summaries. Fitting the posterior from comparisons is Phase 2;
 * this module already works with any weighted set of parameter particles.
 */
import { DEFAULT_PARAMS, DEFAULT_SETTINGS, TIER_A_STRONG_BONUS } from './defaults.js';
import {
  NO_MATCH,
  type Band,
  type CoupleSettings,
  type ModelParams,
  type Pair,
  type PairId,
  type PartnerIndex,
  type Posterior,
  type ScoreSummary,
} from './types.js';

export function cloneParams(p: ModelParams): ModelParams {
  return {
    base: [{ ...p.base[0] }, { ...p.base[1] }],
    s: [p.s[0], p.s[1]],
    pen: { ...p.pen },
    vNM: p.vNM,
  };
}

/** A point-mass posterior on the defaults (what the couple gets before answering anything). */
export function defaultPosterior(params: ModelParams = DEFAULT_PARAMS): Posterior {
  return { particles: [cloneParams(params)], weights: [1] };
}

/** v_k(i) = base_k(tier) + s_k * (1 - (pos - 1) / max(1, n - 1)); NO_MATCH gets v_NM. */
export function partnerValue(params: ModelParams, pair: Pair, k: PartnerIndex): number {
  if (pair.programs[k] === NO_MATCH) return params.vNM;
  const tier = pair.tier[k]!;
  const frac = (pair.posInTier[k] - 1) / Math.max(1, pair.tierSize[k] - 1);
  return params.base[k][tier] + params.s[k] * (1 - frac);
}

/** Saturating step penalty: Together = 0; Apart is flat no matter how far. */
export function distancePenalty(params: ModelParams, band: Band): number {
  switch (band) {
    case 'together':
    case 'no_match':
      return 0;
    case 'commutable':
      return params.pen.commutable;
    case 'drivable':
      return params.pen.drivable;
    case 'apart':
      return params.pen.apart;
  }
}

function strongTierABonus(pair: Pair, settings: CoupleSettings): number {
  let bonus = 0;
  for (const k of [0, 1] as const) {
    const other = (1 - k) as PartnerIndex;
    if (settings.tierARule[k] === 'strong' && pair.tier[k] === 'A' && pair.programs[other] !== NO_MATCH) {
      bonus += TIER_A_STRONG_BONUS;
    }
  }
  return bonus;
}

/** S(i, j) = w·v1(i) + (2 − w)·v2(j) − pen(band) (+ Tier A bonus in "strong" mode). */
export function pairScore(params: ModelParams, pair: Pair, settings: CoupleSettings = DEFAULT_SETTINGS): number {
  const w = settings.balance;
  return (
    w * partnerValue(params, pair, 0) +
    (2 - w) * partnerValue(params, pair, 1) -
    distancePenalty(params, pair.band) +
    strongTierABonus(pair, settings)
  );
}

/** Posterior mean and standard deviation of every pair's score. */
export function scorePairs(
  pairs: Pair[],
  posterior: Posterior,
  settings: CoupleSettings = DEFAULT_SETTINGS,
): Map<PairId, ScoreSummary> {
  const totalW = posterior.weights.reduce((a, b) => a + b, 0) || 1;
  const out = new Map<PairId, ScoreSummary>();
  for (const pair of pairs) {
    let mean = 0;
    let sq = 0;
    for (let p = 0; p < posterior.particles.length; p++) {
      const w = posterior.weights[p] / totalW;
      if (w === 0) continue;
      const s = pairScore(posterior.particles[p], pair, settings);
      mean += w * s;
      sq += w * s * s;
    }
    out.set(pair.id, { mean, sd: Math.sqrt(Math.max(0, sq - mean * mean)) });
  }
  return out;
}

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
