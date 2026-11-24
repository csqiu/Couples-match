/**
 * The NRMP Main Residency Match Program Directory (see nrmp-directory/ and
 * docs/data-sources.md) → programs. One program per NRMP track: that's what a
 * couple ranks in R3, and it carries the official NRMP code.
 *
 * The directory gives city and state but no street address, so locations are
 * city-level (from seed/nrmp-cities.json), except where a seed program gives
 * the hospital's exact position.
 */
import { normalizeSpecialty, specialtyByCode, type Specialty } from './specialties';
import type { ProgramRecord } from './types';
import { stateAbbreviation, tidyCity } from './us-states';

export const NRMP_DIRECTORY_SOURCE = 'nrmp-directory';

/** Tracks that can be ranked. Withdrawn and not-participating tracks are left out. */
export const RANKABLE_STATUSES = new Set(['Active', 'Initial']);

/** Track letter (8th character of the NRMP code). */
export const TRACK_TYPES: Record<string, string> = {
  C: 'Categorical',
  P: 'Preliminary',
  A: 'Advanced',
  R: 'Physician only',
  M: 'Primary care',
};

export interface DirectoryRow {
  Specialty: string;
  'Program Name': string;
  City: string;
  State: string;
  'Program Status': string;
  'NRMP Code': string;
  'ACGME Code': string;
}

export interface CityPoint {
  lat: number;
  lon: number;
  matched?: string;
}

export type DirectorySkip = { code: string; reason: 'not_rankable' | 'unknown_specialty' | 'bad_code' | 'unknown_state'; detail?: string };

/** 9 characters, or 10 from a program's 11th track (e.g. 2978140C10). */
/**
 * City names the directory gets wrong: typos, a phone number, a room number. Keyed by
 * the lower-case directory value (with the state where the value alone is ambiguous).
 */
const CITY_FIXES: Record<string, string> = {
  '.|CT': 'New Haven', // Yale-New Haven Hosp
  '.|TN': 'Nashville', // Vanderbilt Univ Med Ctr
  '7346474144': 'Ann Arbor', // Univ of Michigan Hosps (a phone number)
  'room b713': 'Los Angeles', // UCLA Med Ctr
  'tripler amc': 'Honolulu',
  'fort bliss': 'El Paso',
  'st. ventura': 'Ventura',
  'carmel hamlet': 'Carmel',
  baltinore: 'Baltimore',
  bethelem: 'Bethlehem',
  brookyln: 'Brooklyn',
  charletson: 'Charleston',
  cincinnnati: 'Cincinnati',
  fisherville: 'Fishersville',
  galveton: 'Galveston',
  'grand juction': 'Grand Junction',
  greenvllle: 'Greenville',
  kissinnee: 'Kissimmee',
  lawerenceville: 'Lawrenceville',
  'los angeles,ca': 'Los Angeles',
  metaire: 'Metairie',
  montogmery: 'Montgomery',
  'new hyde park,new york 11040': 'New Hyde Park',
  newyork: 'New York',
  parkridge: 'Park Ridge',
  'pasadena ca': 'Pasadena',
  pennnington: 'Pennington',
  philadelphai: 'Philadelphia',
  portand: 'Portland',
  rosevillle: 'Roseville',
  'san franciso': 'San Francisco',
  shrevesport: 'Shreveport',
  'sleepy holllow': 'Sleepy Hollow',
  'tampa,fl': 'Tampa',
  "tom's river": 'Toms River',
  vahalla: 'Valhalla',
  valhalls: 'Valhalla',
  westminister: 'Westminster',
};

/** The directory's city, tidied and corrected. */
export function directoryCity(raw: string, state: string): string {
  const key = raw.trim().toLowerCase();
  return CITY_FIXES[`${key}|${state}`] ?? CITY_FIXES[key] ?? tidyCity(raw);
}

const NRMP_CODE = /^[0-9]{7}[A-Z][0-9]{1,2}$/;

/** "Temple Univ Hosp-PA" → "Temple Univ Hosp"; "Univ of Alabama Hospital-Birmingham-AL" → "Univ of Alabama Hospital". */
export function institutionName(programName: string, city: string, state: string): string {
  let n = programName.trim().replace(/\s+/g, ' ');
  n = n.replace(new RegExp(`-${state}$`, 'i'), '');
  const c = city.trim().toLowerCase();
  if (n.toLowerCase().endsWith(`-${c}`)) n = n.slice(0, -(c.length + 1));
  return n.trim();
}

/** Preliminary medicine and surgery tracks have their own specialties (as applicants think of them). */
function specialtyFor(raw: string, track: string): Specialty | undefined {
  const s = normalizeSpecialty(raw);
  if (track === 'P' && s?.code === 'internal-medicine') return specialtyByCode('preliminary-medicine');
  if (track === 'P' && s?.code === 'general-surgery') return specialtyByCode('preliminary-surgery');
  return s;
}

export function trackLabel(code: string, specialty: Specialty): string {
  const letter = code[7];
  const parts: string[] = [];
  const prelimSpecialty = ['preliminary-medicine', 'preliminary-surgery', 'transitional-year'].includes(specialty.code);
  if (letter !== 'C' && !(letter === 'P' && prelimSpecialty)) parts.push(TRACK_TYPES[letter] ?? letter);
  const n = Number(code.slice(8));
  if (n > 0) parts.push(`track ${n + 1}`);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

export function directoryToPrograms(
  rows: DirectoryRow[],
  cities: Record<string, CityPoint | null>,
): { programs: ProgramRecord[]; skipped: DirectorySkip[] } {
  const programs: ProgramRecord[] = [];
  const skipped: DirectorySkip[] = [];
  for (const r of rows) {
    const code = r['NRMP Code'].trim();
    if (!NRMP_CODE.test(code)) {
      skipped.push({ code, reason: 'bad_code' });
      continue;
    }
    if (!RANKABLE_STATUSES.has(r['Program Status'])) {
      skipped.push({ code, reason: 'not_rankable', detail: r['Program Status'] });
      continue;
    }
    const specialty = specialtyFor(r.Specialty, code[7]);
    if (!specialty || specialty.matchType !== 'main') {
      skipped.push({ code, reason: 'unknown_specialty', detail: r.Specialty });
      continue;
    }
    const state = stateAbbreviation(r.State);
    if (!state) {
      skipped.push({ code, reason: 'unknown_state', detail: r.State });
      continue;
    }
    const city = directoryCity(r.City, state);
    const institution = institutionName(r['Program Name'], r.City, state);
    const point = cities[`${city}, ${state}`] ?? null;
    programs.push({
      id: `nrmp-${code}`,
      name: `${institution} — ${specialty.name}${trackLabel(code, specialty)}`,
      institution,
      specialtyCode: specialty.code,
      specialtyName: specialty.name,
      matchType: 'main',
      matchName: specialty.matchName,
      nrmpCode: code,
      acgmeId: r['ACGME Code'].trim() || null,
      city,
      state,
      address: `${city}, ${state}`,
      lat: point?.lat ?? null,
      lon: point?.lon ?? null,
      // City-level: a city centre, not the hospital.
      geocodeConfidence: point ? 0.5 : null,
      geocodeSource: point ? 'nominatim' : null,
      cbsaCode: null,
      cbsaName: null,
      isAdvanced: code[7] === 'A',
      source: NRMP_DIRECTORY_SOURCE,
      // Official directory data: listed for everyone without an admin approving each one.
      verified: true,
      createdByCouple: null,
    });
  }
  return { programs, skipped };
}

/**
 * Where a seed program gives a hospital's exact position, use it for every NRMP
 * track of that institution in that city (other specialties at the same
 * hospital), instead of the city centre. The first seed for an institution wins.
 * Returns how many programs got an exact position.
 */
export function applySeedPositions(programs: ProgramRecord[], seeds: ProgramRecord[], seedToCode: Record<string, string>): number {
  const byCode = new Map(programs.map((p) => [p.nrmpCode, p]));
  const exact = new Map<string, ProgramRecord>();
  for (const seed of seeds) {
    const target = byCode.get(seedToCode[seed.id]);
    if (!target || seed.lat == null) continue;
    const key = `${target.institution.toLowerCase()}|${target.city.toLowerCase()}|${target.state}`;
    if (!exact.has(key)) exact.set(key, seed);
  }
  let n = 0;
  for (const p of programs) {
    const seed = exact.get(`${p.institution.toLowerCase()}|${p.city.toLowerCase()}|${p.state}`);
    if (!seed) continue;
    Object.assign(p, {
      lat: seed.lat,
      lon: seed.lon,
      address: seed.address,
      geocodeConfidence: seed.geocodeConfidence,
      geocodeSource: seed.geocodeSource,
    });
    n++;
  }
  return n;
}
