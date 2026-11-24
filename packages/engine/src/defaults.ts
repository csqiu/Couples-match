/**
 * Every distance, tier and model default lives here (spec: "one defaults.ts").
 */
import type { CoupleSettings, DistanceBands, ModelParams } from './types';
import { NRMP_RULES } from './rules';

/** Bumped whenever a change could reorder a saved list. Stored with each version. */
export const ENGINE_VERSION = '0.2.0';

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

/** Number of parameter samples in the posterior (Section 5.3). */
export const PARTICLE_COUNT = 2000;
/** Metropolis steps per particle after each resample, and their step size in latent units. */
export const MH_STEPS = 3;
export const MH_STEP_SD = 0.35;

/**
 * Prior widths, on the latent scale (see learning.ts). Each multiplicative
 * parameter is log-normal around its default with these log-sds; `cLevel` is an
 * additive sd for the Tier C level.
 */
export const PRIOR_LOG_SD = {
  s: 0.5,
  cLevel: 0.3,
  gap: 0.7,
  pen: 0.8,
  nm: 0.4,
};

/** Active learning (Section 5.6). */
export const QUESTION_WINDOW = 20;
export const CALIBRATION_QUESTIONS = 5;
/** Calibration questions are looked for among the top N list positions, widening in these steps. */
export const CALIBRATION_SEARCH_DEPTHS = [30, 60, 100];
export const TRADEOFF_BOOST = 1.5;
/** Positions beyond this count less toward a question's impact. */
export const IMPACT_FOCUS_TOP = 100;
export const IMPACT_TAIL_WEIGHT = 0.25;
export const STOP_ORDER_CONFIDENCE = 0.9;
export const STOP_ADJACENT_FRACTION = 0.9;
export const STOP_TOP = 100;
export const MAX_QUESTIONS = 40;
/**
 * A comparison between (a1, b1) and (a2, b2) is moot when a "swapped" pair (a1, b2) or
 * (a2, b1) sits above both: whenever both are reachable in the Match, the swapped pair is
 * too, so their order never decides the outcome. "Above" means a hard rule, or the
 * current list with at least this much model confidence. See DECISIONS.md.
 */
export const MOOT_CONFIDENCE = 0.9;

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
