/**
 * The pair score is linear in the model parameters:
 *
 *   S(pair) = θ · φ(pair) + bonus(pair)
 *
 * θ packs every parameter into 12 numbers; φ is a fixed feature vector per pair.
 * This makes fitting, posterior moments and question selection cheap: a
 * comparison is just the difference of two feature vectors.
 */
import { TIER_A_STRONG_BONUS } from './defaults.js';
import { NO_MATCH, type CoupleSettings, type ModelParams, type Pair, type PartnerIndex, type Tier } from './types.js';

export const THETA_DIM = 12;
/** Layout of θ. */
export const T = {
  base: [
    { A: 0, B: 1, C: 2 },
    { A: 4, B: 5, C: 6 },
  ] as const,
  s: [3, 7] as const,
  penCommutable: 8,
  penDrivable: 9,
  penApart: 10,
  vNM: 11,
};

export function paramsToTheta(p: ModelParams): Float64Array {
  const t = new Float64Array(THETA_DIM);
  for (const k of [0, 1] as const) {
    t[T.base[k].A] = p.base[k].A;
    t[T.base[k].B] = p.base[k].B;
    t[T.base[k].C] = p.base[k].C;
    t[T.s[k]] = p.s[k];
  }
  t[T.penCommutable] = p.pen.commutable;
  t[T.penDrivable] = p.pen.drivable;
  t[T.penApart] = p.pen.apart;
  t[T.vNM] = p.vNM;
  return t;
}

export function thetaToParams(t: ArrayLike<number>): ModelParams {
  const tv = (k: PartnerIndex) => ({ A: t[T.base[k].A], B: t[T.base[k].B], C: t[T.base[k].C] });
  return {
    base: [tv(0), tv(1)],
    s: [t[T.s[0]], t[T.s[1]]],
    pen: { commutable: t[T.penCommutable], drivable: t[T.penDrivable], apart: t[T.penApart] },
    vNM: t[T.vNM],
  };
}

export interface PairFeatures {
  phi: Float64Array;
  bonus: number;
}

/** φ(pair) and the constant (strong Tier A) bonus, so that S = θ·φ + bonus. */
export function pairFeatures(pair: Pair, settings: CoupleSettings): PairFeatures {
  const phi = new Float64Array(THETA_DIM);
  const w = [settings.balance, 2 - settings.balance];
  let bonus = 0;
  for (const k of [0, 1] as const) {
    if (pair.programs[k] === NO_MATCH) {
      phi[T.vNM] += w[k];
      continue;
    }
    const tier = pair.tier[k] as Tier;
    phi[T.base[k][tier]] += w[k];
    phi[T.s[k]] += w[k] * (1 - (pair.posInTier[k] - 1) / Math.max(1, pair.tierSize[k] - 1));
    const other = (1 - k) as PartnerIndex;
    if (settings.tierARule[k] === 'strong' && tier === 'A' && pair.programs[other] !== NO_MATCH) {
      bonus += TIER_A_STRONG_BONUS;
    }
  }
  if (pair.band === 'commutable') phi[T.penCommutable] = -1;
  else if (pair.band === 'drivable') phi[T.penDrivable] = -1;
  else if (pair.band === 'apart') phi[T.penApart] = -1;
  return { phi, bonus };
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < THETA_DIM; i++) s += a[i] * b[i];
  return s;
}

/** xᵀ Σ x for a dense THETA_DIM × THETA_DIM covariance stored row-major. */
export function quadForm(cov: Float64Array, x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < THETA_DIM; i++) {
    const xi = x[i];
    if (xi === 0) continue;
    let row = 0;
    for (let j = 0; j < THETA_DIM; j++) row += cov[i * THETA_DIM + j] * x[j];
    s += xi * row;
  }
  return s;
}
