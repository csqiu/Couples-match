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
    return a && b ? [{ a, b, distanceMi: d.distance_mi }] : [];
  });
  // Name similarity isn't checked in the database; show the likeliest pairs first.
  pairs.sort((x, y) => nameSimilarity(y.a.name, y.b.name) - nameSimilarity(x.a.name, x.b.name) || x.distanceMi - y.distanceMi);
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

const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['the', 'and', 'program', 'residency', 'hospital', 'medical', 'center'].includes(w)),
  );

/** Share of words in common (Jaccard), 0..1. */
export function nameSimilarity(a: string, b: string): number {
  const x = words(a);
  const y = words(b);
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
