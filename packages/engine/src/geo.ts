import type { Band, DistanceBands, ProgramInfo } from './types.js';

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle distance in miles. */
export function haversineMi(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance between two programs, or null if either has no coordinates. */
export function programDistanceMi(a: ProgramInfo, b: ProgramInfo): number | null {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  return haversineMi({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
}

/**
 * Band for two matched programs. Same CBSA is always Together. Unknown distance
 * (missing coordinates, different or unknown CBSA) is treated as Apart — the
 * conservative choice, so a missing geocode never makes a pair look closer.
 */
export function bandFor(distanceMi: number | null, sameCbsa: boolean, bands: DistanceBands): Band {
  if (sameCbsa) return 'together';
  if (distanceMi == null) return 'apart';
  if (distanceMi <= bands.togetherMi) return 'together';
  if (distanceMi <= bands.commutableMi) return 'commutable';
  if (distanceMi <= bands.drivableMi) return 'drivable';
  return 'apart';
}

/**
 * Ordinal used by the dominance rule (lower = better). A No Match pair has no
 * distance penalty in the scoring model, so it sits at the "together" level;
 * the separate No-Match-at-bottom rule is what pushes it down.
 */
export const DOMINANCE_BAND_RANK: Record<Band, number> = {
  together: 0,
  commutable: 1,
  drivable: 2,
  apart: 3,
  no_match: 0,
};

export const BAND_LABEL: Record<Band, string> = {
  together: 'Together',
  commutable: 'Commutable',
  drivable: 'Drivable',
  apart: 'Apart',
  no_match: 'No Match',
};
