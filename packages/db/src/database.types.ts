/**
 * Friendly names for the generated Supabase types (supabase.types.ts). The
 * generated file is the source of truth; regenerate it after each migration.
 */
import type { Database, Enums, Json, Tables } from './supabase.types';

export type { Database, Json };

export type MatchType = Enums<'match_type'>;
export type CoupleStatus = Enums<'couple_status'>;
export type TierEnum = Enums<'tier'>;
export type ComparisonWinner = Enums<'comparison_winner'>;
export type PinSourceEnum = Enums<'pin_source'>;

export type SpecialtyRow = Tables<'specialties'>;
export type ProfileRow = Tables<'profiles'>;
export type CoupleRow = Tables<'couples'>;
export type InviteRow = Tables<'invites'>;
export type ProgramRow = Tables<'programs'>;
export type IndividualRankRow = Tables<'individual_ranks'>;
export type ComparisonRow = Tables<'comparisons'>;
export type PinRow = Tables<'pins'>;
export type PairExclusionRow = Tables<'pair_exclusions'>;
export type RuleExceptionRow = Tables<'rule_exceptions'>;
export type ListVersionRow = Tables<'list_versions'>;
export type AuditEventRow = Tables<'audit_events'>;
