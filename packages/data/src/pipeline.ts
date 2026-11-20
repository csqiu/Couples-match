/**
 * Import pipeline (Section 4, steps 2–4 and 6):
 * staging rows → normalized specialty → geocode → CBSA → programs + review queue.
 *
 * The pipeline is source-agnostic: it never fetches program lists itself. Which
 * sources may be imported (and how) is decided by the data-source research
 * (Section 4, step 1), still pending.
 */
import { haversineMi } from '@pairwise/engine';
import type { CbsaIndex } from './cbsa';
import type { Geocoder } from './geocode';
import { normalizeSpecialty } from './specialties';
import type { ProgramRecord, Rejected, ReviewItem, StagingRow } from './types';

/** Geocodes below this confidence go to the admin review queue. */
export const GEOCODE_REVIEW_THRESHOLD = 0.8;
/** Same specialty, similar name, and this close together → possible duplicate. */
export const DUPLICATE_RADIUS_MI = 1;

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Deterministic id: stable across re-imports of the same source row. */
export function programId(row: StagingRow, specialtyCode: string): string {
  return row.acgmeId ? `acgme-${row.acgmeId}` : `${slug(row.institution)}--${specialtyCode}--${slug(row.city)}-${row.state.toLowerCase()}`;
}

function nameKey(s: string): string {
  return slug(s).replace(/-(hospital|medical|center|program|university|health|system|the|of|and)\b/g, '');
}

export interface ImportOptions {
  geocoder: Geocoder;
  cbsa?: CbsaIndex;
  /** Programs already in the database, to detect duplicates. */
  existing?: ProgramRecord[];
  createdByCouple?: string | null;
}

export interface ImportResult {
  programs: ProgramRecord[];
  review: ReviewItem[];
  rejected: Rejected[];
}

export async function importPrograms(rows: StagingRow[], opts: ImportOptions): Promise<ImportResult> {
  const programs: ProgramRecord[] = [];
  const review: ReviewItem[] = [];
  const rejected: Rejected[] = [];
  const known: ProgramRecord[] = [...(opts.existing ?? [])];

  for (const row of rows) {
    if (!row.name?.trim() || !row.specialty?.trim() || !row.city?.trim() || !row.state?.trim()) {
      rejected.push({ row, reason: 'missing_fields' });
      continue;
    }
    const specialty = normalizeSpecialty(row.specialty);
    if (!specialty) {
      rejected.push({ row, reason: 'unknown_specialty', detail: row.specialty });
      continue;
    }
    if (specialty.matchType === 'other') {
      rejected.push({ row, reason: 'not_in_nrmp', detail: specialty.matchName });
      continue;
    }

    const address = [row.street, row.city, `${row.state}${row.zip ? ` ${row.zip}` : ''}`].filter(Boolean).join(', ');
    const geo = await opts.geocoder.geocode({ street: row.street, city: row.city, state: row.state, zip: row.zip });
    const cbsa = geo && opts.cbsa ? opts.cbsa.lookup(geo.lat, geo.lon) : null;

    const program: ProgramRecord = {
      id: programId(row, specialty.code),
      name: row.name.trim(),
      institution: row.institution.trim(),
      specialtyCode: specialty.code,
      specialtyName: specialty.name,
      matchType: specialty.matchType,
      matchName: specialty.matchName,
      nrmpCode: null,
      acgmeId: row.acgmeId ?? null,
      city: row.city.trim(),
      state: row.state.trim().toUpperCase(),
      address,
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      geocodeConfidence: geo?.confidence ?? null,
      geocodeSource: geo?.source ?? null,
      cbsaCode: cbsa?.code ?? null,
      cbsaName: cbsa?.name ?? null,
      isAdvanced: !!row.isAdvanced,
      source: row.source,
      verified: false,
      createdByCouple: opts.createdByCouple ?? null,
    };

    const reasons: ReviewItem['reasons'] = [];
    if (!geo) reasons.push('no_geocode');
    else if (geo.confidence < GEOCODE_REVIEW_THRESHOLD) reasons.push('low_confidence');
    if (geo && opts.cbsa && !cbsa) reasons.push('outside_cbsa');

    const dup = known.find(
      (k) =>
        k.specialtyCode === program.specialtyCode &&
        (k.id === program.id ||
          (nameKey(k.institution) === nameKey(program.institution) &&
            k.lat != null &&
            program.lat != null &&
            haversineMi({ lat: k.lat, lon: k.lon! }, { lat: program.lat, lon: program.lon! }) <= DUPLICATE_RADIUS_MI)),
    );
    if (dup) reasons.push('possible_duplicate');

    // A user-added program is always reviewed by an admin before it becomes global.
    program.verified = reasons.length === 0 && !program.createdByCouple && geo?.source !== 'manual';
    if (reasons.length) review.push({ program, reasons, ...(dup ? { duplicateOf: dup.id } : {}) });
    if (!dup) {
      programs.push(program);
      known.push(program);
    }
  }
  return { programs, review, rejected };
}
