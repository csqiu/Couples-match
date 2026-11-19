import {
  withDefaults,
  type CoupleSettings,
  type EngineInput,
  type ModelParams,
  type ProgramInfo,
  type RankEntry,
  type Tier,
} from '../src/index.js';

/** Small seeded PRNG (mulberry32) so property tests are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
  };
}

export const METROS = [
  { name: 'Boston', lat: 42.36, lon: -71.06, cbsa: '14460' },
  { name: 'New York', lat: 40.75, lon: -73.99, cbsa: '35620' },
  { name: 'Baltimore', lat: 39.29, lon: -76.61, cbsa: '12580' },
  { name: 'Washington', lat: 38.9, lon: -77.03, cbsa: '47900' },
  { name: 'Chicago', lat: 41.88, lon: -87.63, cbsa: '16980' },
  { name: 'San Francisco', lat: 37.77, lon: -122.42, cbsa: '41860' },
  { name: 'Houston', lat: 29.76, lon: -95.37, cbsa: '26420' },
  { name: 'Providence', lat: 41.82, lon: -71.41, cbsa: '39300' },
  { name: 'Philadelphia', lat: 39.95, lon: -75.17, cbsa: '37980' },
] as const;

export function program(id: string, metro: (typeof METROS)[number], jitter = 0): ProgramInfo {
  return { id, name: id, lat: metro.lat + jitter, lon: metro.lon + jitter, cbsaCode: metro.cbsa };
}

export function emptyInput(settings: Partial<CoupleSettings> = {}): EngineInput {
  return {
    programs: {},
    lists: [[], []],
    settings: withDefaults(settings),
    pins: [],
    exclusions: [],
    exceptions: [],
    comparisons: [],
    seed: 1,
  };
}

/** Builds a list from [programId, tier] tuples in rank order. */
export function list(spec: Array<[string, Tier]>): RankEntry[] {
  return spec.map(([programId, tier], i) => ({ programId, tier, rank: i + 1, acceptable: true }));
}

/** A random couple: n1/n2 programs spread over random metros with random tiers. */
export function randomInput(seed: number, n1: number, n2: number, settings: Partial<CoupleSettings> = {}): EngineInput {
  const r = rng(seed);
  const input = emptyInput(settings);
  const tiers: Tier[] = ['A', 'B', 'C'];
  for (const k of [0, 1] as const) {
    const n = k === 0 ? n1 : n2;
    const entries: RankEntry[] = [];
    for (let i = 0; i < n; i++) {
      const id = `p${k + 1}-${i}`;
      input.programs[id] = program(id, r.pick(METROS), r.range(-0.15, 0.15));
      entries.push({ programId: id, rank: i + 1, tier: r.pick(tiers), acceptable: r.next() > 0.05 });
    }
    input.lists[k] = entries;
  }
  return input;
}

/** Arbitrary (not necessarily sensible) model parameters. */
export function randomParams(seed: number): ModelParams {
  const r = rng(seed);
  const tv = () => ({ A: r.range(-2, 3), B: r.range(-2, 3), C: r.range(-2, 3) });
  return {
    base: [tv(), tv()],
    s: [r.range(-1, 1), r.range(-1, 1)],
    pen: { commutable: r.range(-1, 2), drivable: r.range(-1, 2), apart: r.range(-1, 2) },
    vNM: r.range(-3, 3),
  };
}
