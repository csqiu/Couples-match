// Shared fixtures for unit tests: a couple built from real seed programs.
import { SEED_PROGRAMS } from '@pairwise/data';
import type { CoupleData } from '@pairwise/db';

export const A = 'user-a';
export const B = 'user-b';
export const names: [string, string] = ['Alex', 'Sam'];

export function couple(opts: { aList?: Array<[string, 'A' | 'B' | 'C']>; bList?: Array<[string, 'A' | 'B' | 'C']>; settings?: object } = {}): CoupleData {
  const aList = opts.aList ?? [['seed-mgh-internal-medicine', 'A'], ['seed-jhh-internal-medicine', 'B'], ['seed-ucsf-internal-medicine', 'B'], ['seed-nm-internal-medicine', 'C']];
  const bList = opts.bList ?? [['seed-bch-pediatrics', 'A'], ['seed-cnh-pediatrics', 'B'], ['seed-ucsfbch-pediatrics', 'B'], ['seed-lurie-pediatrics', 'C']];
  const ids = [...aList, ...bList].map(([id]) => id);
  return {
    couple: { id: 'c1', partner_a: A, partner_b: B, match_type: 'main', settings: (opts.settings ?? {}) as never },
    programs: SEED_PROGRAMS.filter((p) => ids.includes(p.id)).map((p) => ({
      id: p.id, name: p.name, institution: p.institution, city: p.city, state: p.state, lat: p.lat, lon: p.lon,
      cbsa_code: p.cbsaCode, nrmp_code: null, is_advanced: false,
    })),
    ranks: [
      ...aList.map(([program_id, tier], i) => ({ user_id: A, program_id, rank: i + 1, tier, acceptable: true, note: null, nrmp_code: null })),
      ...bList.map(([program_id, tier], i) => ({ user_id: B, program_id, rank: i + 1, tier, acceptable: true, note: null, nrmp_code: null })),
    ],
    comparisons: [],
    pins: [],
    exclusions: [],
    exceptions: [],
  };
}

