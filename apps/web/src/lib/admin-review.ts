/**
 * The admin review queue: which programs need a human look, and why. Pure, so
 * it's unit-tested.
 */
import { GEOCODE_REVIEW_THRESHOLD } from '@pairwise/data';
import type { ProgramRow } from '@pairwise/db';

export type ReviewProgram = Pick<
  ProgramRow,
  | 'id' | 'name' | 'institution' | 'specialty_code' | 'specialty_name' | 'city' | 'state' | 'address'
  | 'lat' | 'lon' | 'geocode_confidence' | 'geocode_source' | 'source' | 'verified' | 'created_by_couple' | 'created_at'
>;

export const REVIEW_COLUMNS =
  'id, name, institution, specialty_code, specialty_name, city, state, address, lat, lon, geocode_confidence, geocode_source, source, verified, created_by_couple, created_at';

export type ReviewReason = 'added_by_couple' | 'no_location' | 'low_confidence' | 'possible_duplicate';

export const REASON_LABEL: Record<ReviewReason, string> = {
  added_by_couple: 'Added by a couple',
  no_location: 'No map location',
  low_confidence: 'Location may be off',
  possible_duplicate: 'Possible duplicate',
};

/**
 * The database lists every same-specialty pair within a mile. On a medical campus
 * that's many different hospitals, so a pair counts as a possible duplicate only
 * if the names are alike or it's practically the same address.
 */
export const DUPLICATE_NAME_SIMILARITY = 0.3;
export const DUPLICATE_SAME_ADDRESS_MI = 0.15;

type Named = Pick<ReviewProgram, 'name' | 'institution' | 'specialty_name'>;

export function looksLikeDuplicate(a: Named, b: Named, distanceMi: number) {
  // Both are in the same specialty, so its words say nothing about the hospital.
  const ignore = a.specialty_name;
  return (
    distanceMi <= DUPLICATE_SAME_ADDRESS_MI ||
    nameSimilarity(a.name, b.name, ignore) >= DUPLICATE_NAME_SIMILARITY ||
    nameSimilarity(a.institution, b.institution) >= 0.6
  );
}

export interface DuplicatePair {
  a: ReviewProgram;
  b: ReviewProgram;
  distanceMi: number;
}

export interface ReviewQueue {
  duplicates: DuplicatePair[];
  /** Unverified programs with something to fix or decide, each with its reasons. */
  attention: Array<{ program: ReviewProgram; reasons: ReviewReason[] }>;
  /** Unverified, but nothing looks wrong: can be approved in bulk. */
  routine: ReviewProgram[];
}

export function reasonsFor(p: ReviewProgram, duplicateIds: Set<string>): ReviewReason[] {
  const reasons: ReviewReason[] = [];
  if (p.created_by_couple) reasons.push('added_by_couple');
  if (p.lat == null) reasons.push('no_location');
  else if (p.geocode_confidence == null || p.geocode_confidence < GEOCODE_REVIEW_THRESHOLD) reasons.push('low_confidence');
  if (duplicateIds.has(p.id)) reasons.push('possible_duplicate');
  return reasons;
}

export function buildQueue(
  unverified: ReviewProgram[],
  duplicates: Array<{ program_a: string; program_b: string; distance_mi: number }>,
  byId: Map<string, ReviewProgram>,
): ReviewQueue {
  const pairs: DuplicatePair[] = duplicates.flatMap((d) => {
    const a = byId.get(d.program_a);
    const b = byId.get(d.program_b);
    return a && b && looksLikeDuplicate(a, b, d.distance_mi) ? [{ a, b, distanceMi: d.distance_mi }] : [];
  });
  // Name similarity isn't checked in the database; show the likeliest pairs first.
  pairs.sort((x, y) => nameSimilarity(y.a.name, y.b.name, y.a.specialty_name) - nameSimilarity(x.a.name, x.b.name, x.a.specialty_name) || x.distanceMi - y.distanceMi);
  const dupIds = new Set(pairs.flatMap((p) => [p.a.id, p.b.id]));
  const attention: ReviewQueue['attention'] = [];
  const routine: ReviewProgram[] = [];
  for (const p of unverified) {
    const reasons = reasonsFor(p, dupIds);
    if (reasons.length) attention.push({ program: p, reasons });
    else routine.push(p);
  }
  // Couples are waiting on their own programs: those first, oldest first.
  attention.sort(
    (x, y) =>
      Number(!x.program.created_by_couple) - Number(!y.program.created_by_couple) ||
      x.program.created_at.localeCompare(y.program.created_at),
  );
  return { duplicates: pairs, attention, routine };
}

const words = (s: string, ignore = '') => {
  const skip = new Set(ignore.toLowerCase().split(/[^a-z0-9]+/));
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !skip.has(w) && !['the', 'and', 'program', 'residency', 'hospital', 'medical', 'center'].includes(w)),
  );
};

/** Share of words in common (Jaccard), 0..1. */
export function nameSimilarity(a: string, b: string, ignore = ''): number {
  const x = words(a, ignore);
  const y = words(b, ignore);
  if (!x.size || !y.size) return 0;
  let both = 0;
  for (const w of x) if (y.has(w)) both++;
  return both / (x.size + y.size - both);
}

/** Splits a stored "street, city, ST 12345" address back into geocoder fields. */
export function parseAddress(p: Pick<ReviewProgram, 'address' | 'city' | 'state'>) {
  const parts = p.address.split(',').map((s) => s.trim()).filter(Boolean);
  const zip = parts.at(-1)?.match(/\b(\d{5})(?:-\d{4})?$/)?.[1];
  const street = parts.length >= 3 ? parts.slice(0, -2).join(', ') : '';
  return { street, city: p.city, state: p.state, zip };
}
