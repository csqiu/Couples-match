/**
 * Types for the Supabase client, in the shape `supabase gen types typescript`
 * produces. Hand-written to match supabase/migrations; once a Supabase project
 * exists, regenerate with:
 *
 *   supabase gen types typescript --local > packages/db/src/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type MatchType = 'main' | 'sms_fellowship';
export type CoupleStatus = 'pending' | 'active' | 'dissolved';
export type TierEnum = 'A' | 'B' | 'C';
export type ComparisonWinner = 'left' | 'right' | 'tie';
export type PinSourceEnum = 'comparison' | 'manual_drag' | 'conflict_resolution';

export interface SpecialtyRow {
  code: string;
  name: string;
  match_type: 'main' | 'sms_fellowship' | 'other';
  match_name: string;
}

export interface ProfileRow {
  user_id: string;
  email: string;
  display_name: string | null;
  specialty: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface CoupleRow {
  id: string;
  partner_a: string | null;
  partner_b: string | null;
  match_type: MatchType;
  match_name: string;
  match_year: number;
  status: CoupleStatus;
  settings: Json;
  created_at: string;
  activated_at: string | null;
  dissolved_at: string | null;
}

export interface InviteRow {
  id: string;
  couple_id: string;
  email: string;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ProgramRow {
  id: string;
  name: string;
  institution: string;
  specialty_code: string;
  specialty_name: string;
  match_type: MatchType;
  match_name: string;
  nrmp_code: string | null;
  acgme_id: string | null;
  city: string;
  state: string;
  address: string;
  lat: number | null;
  lon: number | null;
  geom: unknown;
  geocode_confidence: number | null;
  geocode_source: 'census' | 'nominatim' | 'manual' | null;
  cbsa_code: string | null;
  cbsa_name: string | null;
  is_advanced: boolean;
  source: string;
  verified: boolean;
  created_by_couple: string | null;
  created_at: string;
}

export interface IndividualRankRow {
  couple_id: string;
  user_id: string;
  program_id: string;
  rank: number;
  tier: TierEnum;
  acceptable: boolean;
  note: string | null;
  nrmp_code: string | null;
  updated_at: string;
}

export interface ComparisonRow {
  id: string;
  couple_id: string;
  pair_left: string;
  pair_right: string;
  winner: ComparisonWinner;
  answered_by: string | null;
  both_agreed: boolean;
  locked: boolean;
  seq: number;
  created_at: string;
}

export interface PinRow {
  id: string;
  couple_id: string;
  higher_pair: string;
  lower_pair: string;
  source: PinSourceEnum;
  comparison_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PairExclusionRow {
  id: string;
  couple_id: string;
  program_a: string;
  program_b: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface RuleExceptionRow {
  id: string;
  couple_id: string;
  higher_pair: string;
  lower_pair: string;
  created_by: string | null;
  created_at: string;
}

export interface ListVersionRow {
  id: string;
  couple_id: string;
  name: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  engine_version: string;
  inputs_snapshot: Json;
  pairs: Json;
  is_frozen: boolean;
}

export interface AuditEventRow {
  id: number;
  couple_id: string;
  user_id: string | null;
  type: string;
  payload: Json;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      specialties: Table<SpecialtyRow, never, never>;
      profiles: Table<ProfileRow, never, Pick<ProfileRow, 'display_name' | 'specialty'>>;
      couples: Table<
        CoupleRow,
        Pick<CoupleRow, 'partner_a' | 'match_type' | 'match_name' | 'match_year'> & { settings?: Json },
        { settings?: Json }
      >;
      invites: Table<InviteRow, never, never>;
      programs: Table<
        ProgramRow,
        Pick<ProgramRow, 'name' | 'institution' | 'specialty_code' | 'specialty_name' | 'match_type' | 'match_name' | 'created_by_couple'> &
          Partial<Pick<ProgramRow, 'city' | 'state' | 'address' | 'lat' | 'lon' | 'geocode_confidence' | 'geocode_source'>> & {
            source: 'user';
            verified: false;
          },
        Partial<ProgramRow>
      >;
      individual_ranks: Table<
        IndividualRankRow,
        Omit<IndividualRankRow, 'updated_at' | 'acceptable' | 'note' | 'nrmp_code'> &
          Partial<Pick<IndividualRankRow, 'acceptable' | 'note' | 'nrmp_code'>>,
        Partial<Omit<IndividualRankRow, 'couple_id' | 'user_id' | 'updated_at'>>
      >;
      comparisons: Table<
        ComparisonRow,
        Pick<ComparisonRow, 'couple_id' | 'pair_left' | 'pair_right' | 'winner' | 'answered_by'> &
          Partial<Pick<ComparisonRow, 'both_agreed' | 'locked'>>,
        Partial<Pick<ComparisonRow, 'winner' | 'both_agreed' | 'locked'>>
      >;
      pins: Table<PinRow, Pick<PinRow, 'couple_id' | 'higher_pair' | 'lower_pair' | 'source' | 'created_by'> & { comparison_id?: string | null }, never>;
      pair_exclusions: Table<
        PairExclusionRow,
        Pick<PairExclusionRow, 'couple_id' | 'program_a' | 'program_b' | 'created_by'> & { reason?: string | null },
        never
      >;
      rule_exceptions: Table<RuleExceptionRow, Pick<RuleExceptionRow, 'couple_id' | 'higher_pair' | 'lower_pair' | 'created_by'>, never>;
      list_versions: Table<
        ListVersionRow,
        Pick<ListVersionRow, 'couple_id' | 'name' | 'created_by' | 'engine_version' | 'inputs_snapshot' | 'pairs'> & { note?: string | null },
        Partial<Pick<ListVersionRow, 'name' | 'note'>>
      >;
      audit_events: Table<AuditEventRow, never, never>;
    };
    Views: {
      couple_pair_distances: {
        Row: { couple_id: string; program_a: string; program_b: string; distance_mi: number; same_cbsa: boolean };
        Relationships: [];
      };
    };
    Functions: {
      create_invite: { Args: { p_couple: string; p_email: string }; Returns: { invite_id: string; token: string; expires_at: string }[] };
      revoke_invite: { Args: { p_invite: string }; Returns: undefined };
      invite_preview: {
        Args: { p_token: string };
        Returns: {
          status: 'valid' | 'expired' | 'revoked' | 'accepted';
          inviter_name: string;
          invited_email: string;
          match_type: MatchType;
          match_name: string;
          match_year: number;
        }[];
      };
      accept_invite: { Args: { p_token: string }; Returns: string };
      leave_couple: { Args: { p_couple: string }; Returns: undefined };
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      pair_distance_mi: { Args: { p_a: string; p_b: string }; Returns: number | null };
      is_couple_member: { Args: { p_couple: string }; Returns: boolean };
      is_active_member: { Args: { p_couple: string }; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      match_type: MatchType;
      couple_status: CoupleStatus;
      tier: TierEnum;
      comparison_winner: ComparisonWinner;
      pin_source: PinSourceEnum;
    };
    CompositeTypes: Record<string, never>;
  };
}
