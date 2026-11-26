/**
 * The pair score is linear in the model parameters:
 *
 *   S(pair) = θ · φ(pair) + bonus(pair)
 *
 * θ packs the 12 shared parameters, then (with a layout) one offset per program
 * per partner; φ is a fixed feature vector per pair. This makes fitting,
 * posterior moments and question selection cheap: a comparison is just the
 * difference of two feature vectors.
 */
import { TIER_A_STRONG_BONUS } from './defaults';
import {
  NO_MATCH,
  type CoupleSettings,
  type ModelLayout,
  type ModelParams,
  type Pair,
  type PartnerIndex,
  type Tier,
} from './types';

/** The shared parameters. With a layout, θ is longer (see ModelLayout). */
export const THETA_DIM = 12;
/** Layout of the shared part of θ. */
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

const TIERS: Tier[] = ['A', 'B', 'C'];

/** One offset per acceptable program per partner, from the candidate pairs. */
export function buildLayout(pairs: Pair[]): ModelLayout {
  const seen: [Map<string, Pair>, Map<string, Pair>] = [new Map(), new Map()];
  for (const p of pairs) {
    for (const k of [0, 1] as const) {
      const id = p.programs[k];
      if (id !== NO_MATCH && !seen[k].has(id)) seen[k].set(id, p);
    }
  }
  const index: ModelLayout['index'] = [new Map(), new Map()];
  const tiers: ModelLayout['tiers'] = [[], []];
  let dim = THETA_DIM;
  for (const k of [0, 1] as const) {
    const progs = [...seen[k].entries()].sort(([, a], [, b]) => a.rank[k] - b.rank[k]);
    for (const t of TIERS) {
      const group = progs.filter(([, p]) => p.tier[k] === t).map(([id]) => id);
      if (group.length) tiers[k].push(group);
    }
    for (const [id] of progs) index[k].set(id, dim++);
  }
  return { dim, index, tiers };
}

export function paramsToTheta(p: ModelParams, layout?: ModelLayout): Float64Array {
  const t = new Float64Array(layout?.dim ?? THETA_DIM);
  for (const k of [0, 1] as const) {
    t[T.base[k].A] = p.base[k].A;
    t[T.base[k].B] = p.base[k].B;
    t[T.base[k].C] = p.base[k].C;
    t[T.s[k]] = p.s[k];
    if (layout && p.offsets) for (const [id, i] of layout.index[k]) t[i] = p.offsets[k][id] ?? 0;
  }
  t[T.penCommutable] = p.pen.commutable;
  t[T.penDrivable] = p.pen.drivable;
  t[T.penApart] = p.pen.apart;
  t[T.vNM] = p.vNM;
  return t;
}

export function thetaToParams(t: ArrayLike<number>, layout?: ModelLayout): ModelParams {
  const tv = (k: PartnerIndex) => ({ A: t[T.base[k].A], B: t[T.base[k].B], C: t[T.base[k].C] });
  const params: ModelParams = {
    base: [tv(0), tv(1)],
    s: [t[T.s[0]], t[T.s[1]]],
    pen: { commutable: t[T.penCommutable], drivable: t[T.penDrivable], apart: t[T.penApart] },
    vNM: t[T.vNM],
  };
  if (layout) {
    const off = (k: PartnerIndex) => Object.fromEntries([...layout.index[k]].map(([id, i]) => [id, t[i]]));
    params.offsets = [off(0), off(1)];
  }
  return params;
}

export interface PairFeatures {
  phi: Float64Array;
  bonus: number;
}

/** φ(pair) and the constant (strong Tier A) bonus, so that S = θ·φ + bonus. */
export function pairFeatures(pair: Pair, settings: CoupleSettings, layout?: ModelLayout): PairFeatures {
  const phi = new Float64Array(layout?.dim ?? THETA_DIM);
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
    const oi = layout?.index[k].get(pair.programs[k]);
    if (oi !== undefined) phi[oi] += w[k];
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
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/** xᵀ Σ x for a dense covariance (x.length × x.length) stored row-major. */
export function quadForm(cov: Float64Array, x: ArrayLike<number>): number {
  const n = x.length;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    if (xi === 0) continue;
    let row = 0;
    for (let j = 0; j < n; j++) {
      const xj = x[j];
      if (xj !== 0) row += cov[i * n + j] * xj;
    }
    s += xi * row;
  }
  return s;
}
