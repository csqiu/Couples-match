import { NRMP_RULES, NO_MATCH, type MatchType, type ProgramInfo } from '@pairwise/engine';
import seed from '../seed/programs.json' with { type: 'json' };
import type { ProgramRecord } from './types';

export interface SeedMetro {
  name: string;
  cbsaCodes: string[];
  center: [number, number];
}

export const SEED_PROGRAMS = seed.programs as ProgramRecord[];
export const SEED_METROS = seed.metros as SeedMetro[];

/**
 * The No Match sentinel rows, one per match type (Section 3). In the database
 * they live in `programs`; in the engine they are the NO_MATCH id.
 */
export function noMatchSentinels(): ProgramRecord[] {
  return (['main', 'sms_fellowship'] as MatchType[]).map((matchType) => ({
    id: `${NO_MATCH}-${matchType}`,
    name: 'No Match',
    institution: 'NRMP',
    specialtyCode: 'no-match',
    specialtyName: 'No Match',
    matchType,
    matchName: matchType === 'main' ? 'Main Residency Match' : 'Specialties Matching Service',
    nrmpCode: NRMP_RULES.noMatchCode[matchType],
    acgmeId: null,
    city: '',
    state: '',
    address: '',
    lat: null,
    lon: null,
    geocodeConfidence: null,
    geocodeSource: null,
    cbsaCode: null,
    cbsaName: null,
    isAdvanced: false,
    source: 'nrmp',
    verified: true,
    createdByCouple: null,
  }));
}

/** The engine's view of a program. */
export function toEngineProgram(p: ProgramRecord): ProgramInfo {
  return {
    id: p.id,
    name: p.name,
    institution: p.institution,
    city: p.city,
    state: p.state,
    lat: p.lat,
    lon: p.lon,
    cbsaCode: p.cbsaCode,
    nrmpCode: p.nrmpCode,
    isAdvanced: p.isAdvanced,
  };
}
