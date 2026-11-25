/**
 * Core types for the Pairwise preference engine.
 *
 * The engine is pure: every function takes plain data and returns plain data.
 * Nothing here touches the network, the database, or the clock.
 */

export type Tier = 'A' | 'B' | 'C';
export type PartnerIndex = 0 | 1;
export type MatchType = 'main' | 'sms_fellowship';

/** Sentinel program id meaning "this partner does not match" (NRMP code 999999999 / 888888888). */
export const NO_MATCH = 'NO_MATCH' as const;
export type ProgramRef = string; // a program id, or NO_MATCH

/** A pair id is `${programA}|${programB}` where either side may be NO_MATCH (never both). */
export type PairId = string;

export interface ProgramInfo {
  id: string;
  name: string;
  institution?: string;
  city?: string;
  state?: string;
  lat: number | null;
  lon: number | null;
  /** Census CBSA (metro area) code. Two programs in the same CBSA are always "Together". */
  cbsaCode?: string | null;
  nrmpCode?: string | null;
  isAdvanced?: boolean;
  /** Abbreviation set in the database ("Hopkins Plastics"); the app derives one when absent. */
  shortName?: string;
}

/** One row of a partner's individual rank list. */
export interface RankEntry {
  programId: string;
  /** 1-based position the partner gave this program. Within a tier, lower = preferred. */
  rank: number;
  tier: Tier;
  acceptable: boolean;
  nrmpCode?: string | null;
  note?: string;
}

export type Band = 'together' | 'commutable' | 'drivable' | 'apart' | 'no_match';

export interface DistanceBands {
  /** Same CBSA, or at most this many miles apart. */
  togetherMi: number;
  commutableMi: number;
  drivableMi: number;
}

/**
 * hard   — Tier A pairs are edges in the constraint graph (can never be out-ranked by score).
 * strong — Tier A pairs get a large score bonus instead of an edge.
 * off    — no Tier A rule.
 */
export type TierARuleMode = 'hard' | 'strong' | 'off';

/** Who wins when only one partner can get a Tier A program. null = not asked yet. */
export type TierAPriority = 'partner1' | 'partner2' | 'case_by_case' | null;

export type AnswerMode = 'together' | 'separately';

export interface CoupleSettings {
  matchType: MatchType;
  distanceBands: DistanceBands;
  tierARule: [TierARuleMode, TierARuleMode];
  /** "Rather apart than in Tier C": per partner, A/B pairs (partner matched) above C pairs. */
  tierCRule: [boolean, boolean];
  /** No longer used: when tier rules clash, the score and answers decide (DECISIONS.md #125). */
  tierAPriority?: TierAPriority;
  noMatchAtBottom: boolean;
  /** w in the spec, 0..2. 1 = equal weight. Shown to users only as a balance slider. */
  balance: number;
  /** Requested list length; always clamped to the NRMP cap. */
  listLength: number;
  answerMode: AnswerMode;
}

export type PinSource = 'comparison' | 'manual_drag' | 'conflict_resolution';

/** A hard ordering the couple asserted: `higher` must rank above `lower`. */
export interface Pin {
  id?: string;
  higher: PairId;
  lower: PairId;
  source: PinSource;
  /** When source = comparison, the comparison it came from (for explanations). */
  comparisonId?: string;
  /**
   * For a manual drag: which pair the couple moved. 'higher' = dragged up above `lower`,
   * so it should land where `lower` was; 'lower' = dragged down below `higher`.
   * Absent on older pins (and on other sources): the pin only constrains the order.
   */
  moved?: 'higher' | 'lower';
}

/** A program pair the couple will never accept. */
export interface PairExclusion {
  programA: ProgramRef;
  programB: ProgramRef;
  reason?: string;
}

/** Removes automatic/rule edges from `higher` to `lower` (created when the couple breaks a rule link in a cycle). */
export interface RuleException {
  higher: PairId;
  lower: PairId;
}

export interface Comparison {
  id: string;
  left: PairId;
  right: PairId;
  winner: 'left' | 'right' | 'tie';
  answeredBy?: string;
  /** In "answer separately" mode, true once the couple has agreed on this answer. */
  bothAgreed?: boolean;
  locked?: boolean;
  /** Monotonic order of answers (e.g. created_at as epoch ms). Used only to pick the latest answer. */
  seq?: number;
}

export interface EngineInput {
  programs: Record<string, ProgramInfo>;
  lists: [RankEntry[], RankEntry[]];
  settings: CoupleSettings;
  pins: Pin[];
  exclusions: PairExclusion[];
  exceptions: RuleException[];
  comparisons: Comparison[];
  seed: number;
}

/** A candidate pair with everything the engine needs precomputed. */
export interface Pair {
  id: PairId;
  /** Program for partner 1 / partner 2 (or NO_MATCH). */
  programs: [ProgramRef, ProgramRef];
  /** 1-based individual rank among acceptable programs. NO_MATCH = list length + 1. */
  rank: [number, number];
  tier: [Tier | null, Tier | null];
  /** 1-based position within the tier and the tier's size (for the scoring formula). */
  posInTier: [number, number];
  tierSize: [number, number];
  distanceMi: number | null;
  band: Band;
  /** Index in the candidate array — the deterministic final tie-breaker. */
  index: number;
}

export interface TierValues {
  A: number;
  B: number;
  C: number;
}

/** Parameters of the soft scoring model (Section 5.3). */
export interface ModelParams {
  base: [TierValues, TierValues];
  s: [number, number];
  pen: { commutable: number; drivable: number; apart: number };
  vNM: number;
  /**
   * Per-program adjustment to each partner's value, by program id. It moves a program
   * between its neighbours without changing the partner's own order or leaving its tier,
   * so the steps within a tier don't have to be even. Missing = 0.
   */
  offsets?: [Record<string, number>, Record<string, number>];
}

/**
 * Where each program's offset sits in θ (after the 12 shared parameters). Built
 * from the candidate pairs; a posterior without one has no per-program offsets.
 */
export interface ModelLayout {
  dim: number;
  /** θ index of each partner's program offsets. */
  index: [Map<string, number>, Map<string, number>];
  /** Each partner's programs in order, grouped by tier (only tiers with programs). */
  tiers: [string[][], string[][]];
}

/** Weighted particle approximation of the posterior over ModelParams. */
export interface Posterior {
  particles: ModelParams[];
  weights: number[];
  /** Per-program offsets in θ; absent = the 12 shared parameters only. */
  layout?: ModelLayout;
  /** Each particle's position in the latent space (see learning.ts); enables Metropolis moves. */
  latents?: number[][];
}

export interface ScoreSummary {
  mean: number;
  sd: number;
}

export type EdgeReason =
  | { kind: 'dominance' }
  | { kind: 'tier_a'; partner: PartnerIndex }
  | { kind: 'tier_c'; partner: PartnerIndex }
  | { kind: 'no_match_bottom' }
  | { kind: 'pin'; source: PinSource; pinId?: string; comparisonId?: string }
  /** The couple answered this comparison. Every answer that counts holds in the list. */
  | { kind: 'answer'; comparisonId: string };

export interface Link {
  from: PairId;
  to: PairId;
  reasons: EdgeReason[];
}
