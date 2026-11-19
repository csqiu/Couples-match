import type { MatchType } from '@pairwise/engine';

/** One row as it arrives from a source, before normalization. */
export interface StagingRow {
  /** Where the row came from, e.g. "acgme-2026-export" or "user". */
  source: string;
  sourceId?: string;
  name: string;
  institution: string;
  /** Specialty as the source spells it. */
  specialty: string;
  street: string;
  city: string;
  state: string;
  zip?: string;
  acgmeId?: string;
  isAdvanced?: boolean;
}

export type GeocodeSource = 'census' | 'nominatim' | 'manual';

/** A program, shaped like the `programs` table (Section 3). */
export interface ProgramRecord {
  id: string;
  name: string;
  institution: string;
  specialtyCode: string;
  specialtyName: string;
  matchType: MatchType;
  matchName: string;
  /** Left null: users type codes from R3, stored per couple (Section 4, step 5). */
  nrmpCode: string | null;
  acgmeId: string | null;
  city: string;
  state: string;
  address: string;
  lat: number | null;
  lon: number | null;
  geocodeConfidence: number | null;
  geocodeSource: GeocodeSource | null;
  cbsaCode: string | null;
  cbsaName: string | null;
  isAdvanced: boolean;
  source: string;
  verified: boolean;
  createdByCouple: string | null;
  /** Primary teaching site, when it differs from the sponsoring institution. */
  site?: string;
}

export interface ReviewItem {
  program: ProgramRecord;
  reasons: Array<'no_geocode' | 'low_confidence' | 'possible_duplicate' | 'outside_cbsa'>;
  /** For possible duplicates: the program it may duplicate. */
  duplicateOf?: string;
}

export interface Rejected {
  row: StagingRow;
  reason: 'unknown_specialty' | 'not_in_nrmp' | 'missing_fields';
  detail?: string;
}
