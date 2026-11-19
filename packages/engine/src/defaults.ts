/**
 * Every distance, tier and model default lives here (spec: "one defaults.ts").
 */
import type { CoupleSettings, DistanceBands, ModelParams } from './types.js';
import { NRMP_RULES } from './rules.js';

/** Bumped whenever a change could reorder a saved list. Stored with each version. */
export const ENGINE_VERSION = '0.1.0';

export const DEFAULT_DISTANCE_BANDS: DistanceBands = {
  togetherMi: 30,
  commutableMi: 75,
  drivableMi: 250,
};

/** Model defaults before any answers (Section 5.3). These are also the prior means. */
export const DEFAULT_PARAMS: ModelParams = {
  base: [
    { A: 1.0, B: 0.6, C: 0.3 },
    { A: 1.0, B: 0.6, C: 0.3 },
  ],
  s: [0.2, 0.2],
  pen: { commutable: 0.1, drivable: 0.3, apart: 0.6 },
  vNM: -0.8,
};

/** Score bonus used when the Tier A rule is in "strong" (soft) mode. */
export const TIER_A_STRONG_BONUS = 3.0;

/** Bradley–Terry sharpness: P(left) = sigmoid(BT_BETA * (S_left - S_right)). */
export const BT_BETA = 6;

/** An answer is "surprising" when the model predicts the opposite with at least this probability. */
export const SURPRISE_THRESHOLD = 0.85;

export const DEFAULT_SETTINGS: CoupleSettings = {
  matchType: 'main',
  distanceBands: DEFAULT_DISTANCE_BANDS,
  tierARule: ['hard', 'hard'],
  tierAPriority: null,
  noMatchAtBottom: true,
  balance: 1.0,
  listLength: NRMP_RULES.maxRanksPerPartner,
  answerMode: 'together',
};

/** Warn when trimming this many pairs or fewer would drop the list into a cheaper fee tier. */
export const FEE_TIER_WARNING_MARGIN = 5;

export function withDefaults(partial: Partial<CoupleSettings> = {}): CoupleSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    distanceBands: { ...DEFAULT_DISTANCE_BANDS, ...(partial.distanceBands ?? {}) },
  };
}
