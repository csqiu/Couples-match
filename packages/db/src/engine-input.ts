/**
 * Database rows → the engine's input. The web app loads a couple's rows (RLS
 * guarantees they are the couple's own), passes them here, and runs the engine
 * locally. The same function builds a version's inputs_snapshot.
 */
import {
  ENGINE_VERSION,
  NO_MATCH,
  withDefaults,
  type Comparison,
  type CoupleSettings,
  type EngineInput,
  type MatchType,
  type ProgramInfo,
  type RankEntry,
} from '@pairwise/engine';
import type {
  ComparisonRow,
  CoupleRow,
  IndividualRankRow,
  PairExclusionRow,
  PinRow,
  ProgramRow,
  RuleExceptionRow,
} from './database.types';

/** Couple settings as stored: engine overrides plus app-only fields. */
export interface StoredSettings extends Partial<Omit<CoupleSettings, 'matchType'>> {
  /** "private_tiers": each partner's tiers feed the engine but are hidden from the other in the UI. */
  privacy?: 'shared' | 'private_tiers';
  /** Pairs the couple added to the final list by hand (from "Not on your list"). */
  includedPairs?: string[];
  /** True when the No Match rows at the end of the final list may be moved. */
  noMatchUnlocked?: boolean;
  /**
   * How the final list is shown: tidied by a reading key into an order that matches
   * exactly the same way (engine `tidyOrder`), or the engine's own order. Default 'partner1'.
   */
  listOrder?: 'partner1' | 'partner2' | 'balanced' | 'engine';
  /** Questions (engine questionKey) the couple chose to come back to later. */
  deferredQuestions?: string[];
  /** Questions (engine questionKey) flagged to discuss together. */
  flaggedQuestions?: string[];
}

/** Settings keys the app keeps but the engine never sees. */
export const APP_ONLY_SETTINGS = ['privacy', 'includedPairs', 'noMatchUnlocked', 'listOrder', 'deferredQuestions', 'flaggedQuestions'] as const;

export interface CoupleData {
  couple: Pick<CoupleRow, 'id' | 'partner_a' | 'partner_b' | 'match_type' | 'settings'>;
  programs: Array<Pick<ProgramRow, 'id' | 'name' | 'institution' | 'city' | 'state' | 'lat' | 'lon' | 'cbsa_code' | 'nrmp_code' | 'is_advanced'> & { short_name?: string | null }>;
  ranks: Array<Pick<IndividualRankRow, 'user_id' | 'program_id' | 'rank' | 'tier' | 'acceptable' | 'note' | 'nrmp_code'> & { short_name?: string | null }>;
  comparisons: Array<Pick<ComparisonRow, 'id' | 'pair_left' | 'pair_right' | 'winner' | 'answered_by' | 'both_agreed' | 'locked' | 'seq'>>;
  pins: Array<Pick<PinRow, 'id' | 'higher_pair' | 'lower_pair' | 'source' | 'comparison_id'> & { moved_pair?: string | null }>;
  exclusions: Array<Pick<PairExclusionRow, 'program_a' | 'program_b' | 'reason'>>;
  exceptions: Array<Pick<RuleExceptionRow, 'higher_pair' | 'lower_pair'>>;
}

/** Database No Match sentinel rows ("NO_MATCH-main") map to the engine's NO_MATCH id. */
export function toEngineProgramId(id: string): string {
  return id.startsWith(`${NO_MATCH}-`) ? NO_MATCH : id;
}

/**
 * Deterministic seed per couple so a fitted list is reproducible from its
 * snapshot (any stable 32-bit hash of the couple id would do).
 */
export function coupleSeed(coupleId: string): number {
  let h = 2166136261;
  for (let i = 0; i < coupleId.length; i++) h = Math.imul(h ^ coupleId.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function settingsFrom(couple: Pick<CoupleRow, 'match_type' | 'settings'>): CoupleSettings {
  const stored = (couple.settings ?? {}) as StoredSettings;
  const { privacy: _p, includedPairs: _i, noMatchUnlocked: _u, listOrder: _o, deferredQuestions: _d, flaggedQuestions: _f, ...engine } = stored;
  return withDefaults({ ...engine, matchType: couple.match_type as MatchType });
}

export function buildEngineInput(data: CoupleData): EngineInput {
  const { couple } = data;
  const programs: Record<string, ProgramInfo> = {};
  for (const p of data.programs) {
    if (toEngineProgramId(p.id) === NO_MATCH) continue;
    programs[p.id] = {
      id: p.id,
      name: p.name,
      institution: p.institution,
      city: p.city,
      state: p.state,
      lat: p.lat,
      lon: p.lon,
      cbsaCode: p.cbsa_code,
      nrmpCode: p.nrmp_code,
      isAdvanced: p.is_advanced,
      ...(p.short_name ? { shortName: p.short_name } : {}),
    };
  }

  const listFor = (userId: string | null): RankEntry[] =>
    userId == null
      ? []
      : data.ranks
          .filter((r) => r.user_id === userId && programs[r.program_id])
          .sort((a, b) => a.rank - b.rank)
          .map((r) => ({
            programId: r.program_id,
            rank: r.rank,
            tier: r.tier,
            acceptable: r.acceptable,
            // The official code from the NRMP directory wins over one typed in by hand.
            nrmpCode: programs[r.program_id].nrmpCode ?? r.nrmp_code,
            ...(r.short_name ? { shortName: r.short_name } : {}),
            ...(r.note ? { note: r.note } : {}),
          }));

  const comparisons: Comparison[] = data.comparisons.map((c) => ({
    id: c.id,
    left: c.pair_left,
    right: c.pair_right,
    winner: c.winner,
    ...(c.answered_by ? { answeredBy: c.answered_by } : {}),
    bothAgreed: c.both_agreed,
    locked: c.locked,
    seq: Number(c.seq),
  }));

  return {
    programs,
    lists: [listFor(couple.partner_a), listFor(couple.partner_b)],
    settings: settingsFrom(couple),
    pins: data.pins.map((p) => ({
      id: p.id,
      higher: p.higher_pair,
      lower: p.lower_pair,
      source: p.source,
      ...(p.comparison_id ? { comparisonId: p.comparison_id } : {}),
      ...(p.moved_pair === 'higher' || p.moved_pair === 'lower' ? { moved: p.moved_pair } : {}),
    })),
    exclusions: data.exclusions.map((x) => ({
      programA: toEngineProgramId(x.program_a),
      programB: toEngineProgramId(x.program_b),
      ...(x.reason ? { reason: x.reason } : {}),
    })),
    exceptions: data.exceptions.map((e) => ({ higher: e.higher_pair, lower: e.lower_pair })),
    comparisons,
    seed: coupleSeed(couple.id),
  };
}

/** What a saved version stores, so the list can be reproduced exactly later. */
export function versionSnapshot(input: EngineInput) {
  return { engine_version: ENGINE_VERSION, inputs_snapshot: input };
}
