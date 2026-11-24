import { describe, expect, it } from 'vitest';
import { NO_MATCH, buildCandidates, haversineMi, runEngine, withDefaults } from '@pairwise/engine';
import {
  CachingGeocoder,
  CbsaIndex,
  CensusGeocoder,
  FallbackGeocoder,
  NominatimGeocoder,
  SEED_METROS,
  SEED_PROGRAMS,
  SPECIALTIES,
  importPrograms,
  noMatchSentinels,
  normalizeSpecialty,
  parseCsv,
  sameMatch,
  specialtyByCode,
  throttle,
  toEngineProgram,
  type CbsaFeature,
  type GeocodeResult,
  type Geocoder,
  type StagingRow,
} from '../src/index';

describe('Specialty vocabulary', () => {
  it.each([
    ['Internal Medicine', 'internal-medicine'],
    ['internal medicine - categorical', 'internal-medicine'],
    ['Med-Peds', 'internal-medicine-pediatrics'],
    ['Medicine-Pediatrics', 'internal-medicine-pediatrics'],
    ['OB/GYN', 'obstetrics-gynecology'],
    ['Obstetrics & Gynecology', 'obstetrics-gynecology'],
    ['Surgery-General', 'general-surgery'],
    ['  PEDIATRICS ', 'pediatrics'],
    ['Pulmonary Disease and Critical Care Medicine', 'pulmonary-critical-care'],
    ['cardiology', 'cardiovascular-disease'],
  ])('%s → %s', (raw, code) => {
    expect(normalizeSpecialty(raw)?.code).toBe(code);
  });

  it('unknown specialties are not guessed', () => {
    expect(normalizeSpecialty('Underwater Basket Weaving')).toBeUndefined();
  });

  it('codes and labels are unique', () => {
    expect(new Set(SPECIALTIES.map((s) => s.code)).size).toBe(SPECIALTIES.length);
    const labels = SPECIALTIES.flatMap((s) => [s.name, ...s.aliases].map((l) => l.toLowerCase()));
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('knows which specialties can couple in the same match', () => {
    const im = specialtyByCode('internal-medicine')!;
    expect(sameMatch(im, specialtyByCode('pediatrics')!)).toBe(true);
    expect(sameMatch(im, specialtyByCode('cardiovascular-disease')!)).toBe(false);
    expect(sameMatch(specialtyByCode('cardiovascular-disease')!, specialtyByCode('pediatric-cardiology')!)).toBe(true);
    expect(sameMatch(specialtyByCode('urology')!, specialtyByCode('urology')!)).toBe(false);
  });
});

describe('Seed', () => {
  it('has about 50 programs across 5 specialties in the 6 required metros', () => {
    expect(SEED_PROGRAMS.length).toBeGreaterThanOrEqual(45);
    expect(SEED_PROGRAMS.length).toBeLessThanOrEqual(60);
    expect(new Set(SEED_PROGRAMS.map((p) => p.specialtyCode)).size).toBe(5);
    expect(SEED_METROS.map((m) => m.name)).toEqual(['Boston', 'New York', 'Baltimore/DC', 'Chicago', 'Bay Area', 'Houston']);
    for (const m of SEED_METROS) {
      expect(SEED_PROGRAMS.some((p) => m.cbsaCodes.includes(p.cbsaCode!))).toBe(true);
    }
  });

  it('every program is well-formed: unique id, known specialty, coordinates, CBSA, no invented codes', () => {
    expect(new Set(SEED_PROGRAMS.map((p) => p.id)).size).toBe(SEED_PROGRAMS.length);
    for (const p of SEED_PROGRAMS) {
      const s = specialtyByCode(p.specialtyCode);
      expect(s, p.id).toBeDefined();
      expect(p.specialtyName).toBe(s!.name);
      expect(p.matchType).toBe('main');
      expect(p.lat).toBeTypeOf('number');
      expect(p.lon).toBeTypeOf('number');
      expect(p.cbsaCode).toMatch(/^\d{5}$/);
      expect(p.nrmpCode).toBeNull();
      expect(p.acgmeId).toBeNull();
      expect(['manual', 'census', 'nominatim']).toContain(p.geocodeSource);
      expect(p.verified).toBe(false);
    }
  });

  it("each program's point is inside its metro and agrees with its CBSA", () => {
    for (const p of SEED_PROGRAMS) {
      const metro = SEED_METROS.find((m) => m.cbsaCodes.includes(p.cbsaCode!));
      expect(metro, p.id).toBeDefined();
      const mi = haversineMi({ lat: p.lat!, lon: p.lon! }, { lat: metro!.center[0], lon: metro!.center[1] });
      expect(mi, p.id).toBeLessThan(45);
    }
  });

  it('includes real distance variety: together, commutable (Baltimore–DC), drivable (NYC–Boston) and apart pairs', () => {
    const programs = Object.fromEntries(SEED_PROGRAMS.map((p) => [p.id, toEngineProgram(p)]));
    const im = SEED_PROGRAMS.filter((p) => p.specialtyCode === 'internal-medicine');
    const peds = SEED_PROGRAMS.filter((p) => p.specialtyCode === 'pediatrics');
    const list = (xs: typeof im) => xs.map((p, i) => ({ programId: p.id, rank: i + 1, tier: 'B' as const, acceptable: true }));
    const pairs = buildCandidates({
      programs,
      lists: [list(im), list(peds)],
      settings: withDefaults(),
      pins: [],
      exclusions: [],
      exceptions: [],
      comparisons: [],
      seed: 1,
    });
    const bands = new Set(pairs.map((p) => p.band));
    for (const b of ['together', 'commutable', 'drivable', 'apart', 'no_match']) expect(bands).toContain(b);
  });

  it('runs end to end through the engine', () => {
    const em = SEED_PROGRAMS.filter((p) => p.specialtyCode === 'emergency-medicine').slice(0, 10);
    const psych = SEED_PROGRAMS.filter((p) => p.specialtyCode === 'psychiatry');
    const { list, conflicts } = runEngine({
      programs: Object.fromEntries([...em, ...psych].map((p) => [p.id, toEngineProgram(p)])),
      lists: [
        em.map((p, i) => ({ programId: p.id, rank: i + 1, tier: i < 2 ? 'A' : 'B', acceptable: true })),
        psych.map((p, i) => ({ programId: p.id, rank: i + 1, tier: 'B', acceptable: true })),
      ],
      settings: withDefaults(),
      pins: [],
      exclusions: [],
      exceptions: [],
      comparisons: [],
      seed: 1,
    });
    expect(list.rows.length).toBe((em.length + 1) * (psych.length + 1) - 1);
    expect(conflicts).toHaveLength(0);
  });

  it('No Match sentinels carry the NRMP codes', () => {
    const [main, sms] = noMatchSentinels();
    expect(main.nrmpCode).toBe('999999999');
    expect(sms.nrmpCode).toBe('888888888');
    expect(main.id.startsWith(NO_MATCH)).toBe(true);
  });
});

/** A fake fetch that answers from a table and records calls. */
function fakeFetch(answers: Record<string, unknown>, calls: string[] = []) {
  return async (url: string) => {
    calls.push(url);
    const key = Object.keys(answers).find((k) => url.includes(k));
    return { ok: true, status: 200, json: async () => (key ? answers[key] : []) };
  };
}

describe('Geocoding', () => {
  it('parses the Census geocoder response', async () => {
    const census = new CensusGeocoder(
      fakeFetch({
        geocoding: {
          result: { addressMatches: [{ matchedAddress: '55 FRUIT ST, BOSTON, MA, 02114', coordinates: { x: -71.0686, y: 42.3627 } }] },
        },
      }),
    );
    expect(await census.geocode({ street: '55 Fruit St', city: 'Boston', state: 'MA' })).toEqual({
      lat: 42.3627,
      lon: -71.0686,
      confidence: 0.95,
      source: 'census',
      matchedAddress: '55 FRUIT ST, BOSTON, MA, 02114',
    });
  });

  it('falls back to Nominatim, sends a generic User-Agent, and grades confidence by result type', async () => {
    const seenHeaders: Array<Record<string, string> | undefined> = [];
    const nominatimFetch = async (url: string, init?: { headers?: Record<string, string> }) => {
      seenHeaders.push(init?.headers);
      return { ok: true, status: 200, json: async () => [{ lat: '41.9', lon: '-87.6', display_name: 'x', type: 'city' }] };
    };
    const g = new FallbackGeocoder([
      new CensusGeocoder(fakeFetch({ geocoding: { result: { addressMatches: [] } } })),
      new NominatimGeocoder(nominatimFetch, undefined, async () => {}),
    ]);
    const r = await g.geocode({ street: '', city: 'Chicago', state: 'IL' });
    expect(r?.source).toBe('nominatim');
    expect(r?.confidence).toBeLessThan(0.8); // a city centroid is not good enough
    expect(seenHeaders[0]?.['User-Agent']).toMatch(/^pairwise-program-import/);
  });

  it('caches results, including "not found"', async () => {
    let calls = 0;
    const inner: Geocoder = { geocode: async () => (calls++, null) };
    const cached = new CachingGeocoder(inner);
    await cached.geocode({ street: '1 Main St', city: 'X', state: 'CA' });
    await cached.geocode({ street: '1  main st', city: 'x', state: 'ca' });
    expect(calls).toBe(1);
  });

  it('throttles to the minimum interval', async () => {
    let t = 0;
    const waits: number[] = [];
    const wait = throttle(1000, () => t, async (ms) => {
      waits.push(ms);
      t += ms;
    });
    await wait();
    await wait();
    t += 300;
    await wait();
    expect(waits).toEqual([1000, 700]);
  });
});

describe('CBSA assignment', () => {
  const square = (code: string, name: string, lon0: number, lat0: number, size: number): CbsaFeature => ({
    type: 'Feature',
    properties: { CBSAFP: code, NAME: name, LSAD: 'M1' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[lon0, lat0], [lon0 + size, lat0], [lon0 + size, lat0 + size], [lon0, lat0 + size], [lon0, lat0]]],
    },
  });
  const donut: CbsaFeature = {
    type: 'Feature',
    properties: { CBSAFP: '99999', NAME: 'Donut', LSAD: 'M1' },
    geometry: {
      type: 'MultiPolygon',
      coordinates: [
        [
          [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
          [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
        ],
      ],
    },
  };
  const index = new CbsaIndex([square('14460', 'Boston', -71.5, 42, 1), donut]);

  it('finds the containing metro, respects holes, and returns null outside every metro', () => {
    expect(index.lookup(42.36, -71.06)).toEqual({ code: '14460', name: 'Boston' });
    expect(index.lookup(1, 1)?.code).toBe('99999');
    expect(index.lookup(5, 5)).toBeNull();
    expect(index.lookup(30, -100)).toBeNull();
  });
});

describe('Import pipeline', () => {
  const geo: Record<string, GeocodeResult | null> = {
    '55 Fruit St': { lat: 42.3627, lon: -71.0686, confidence: 0.95, source: 'census' },
    '330 Brookline Ave': { lat: 42.339, lon: -71.106, confidence: 0.6, source: 'nominatim' },
    '1 Nowhere Rd': null,
  };
  const geocoder: Geocoder = { geocode: async (q) => geo[q.street] ?? null };
  const cbsa = new CbsaIndex([
    {
      type: 'Feature',
      properties: { CBSAFP: '14460', NAME: 'Boston-Cambridge-Newton, MA-NH' },
      geometry: { type: 'Polygon', coordinates: [[[-71.5, 42], [-70.5, 42], [-70.5, 43], [-71.5, 43], [-71.5, 42]]] },
    },
  ]);
  const row = (o: Partial<StagingRow>): StagingRow => ({
    source: 'test',
    name: 'Massachusetts General Hospital',
    institution: 'Massachusetts General Hospital',
    specialty: 'Internal Medicine',
    street: '55 Fruit St',
    city: 'Boston',
    state: 'ma',
    ...o,
  });

  it('normalizes, geocodes, assigns CBSA, and routes problems to review or rejection', async () => {
    const { programs, review, rejected } = await importPrograms(
      [
        row({}),
        row({ name: 'BIDMC', institution: 'Beth Israel Deaconess', street: '330 Brookline Ave' }),
        row({ name: 'Lost', institution: 'Lost Hospital', street: '1 Nowhere Rd', specialty: 'Psychiatry' }),
        row({ specialty: 'Urology', name: 'Uro' }),
        row({ specialty: 'Basket Weaving' }),
        row({ specialty: 'IM', name: 'MGH again' }), // same institution + specialty + place → duplicate
      ],
      { geocoder, cbsa },
    );

    const mgh = programs.find((p) => p.name === 'Massachusetts General Hospital')!;
    expect(mgh).toMatchObject({
      specialtyCode: 'internal-medicine',
      matchType: 'main',
      state: 'MA',
      cbsaCode: '14460',
      geocodeSource: 'census',
      verified: true,
      nrmpCode: null,
    });
    expect(programs).toHaveLength(3);
    expect(review.map((r) => [r.program.name, r.reasons])).toEqual([
      ['BIDMC', ['low_confidence']],
      ['Lost', ['no_geocode']],
      ['MGH again', ['possible_duplicate']],
    ]);
    expect(review[2].duplicateOf).toBe(mgh.id);
    expect(rejected.map((r) => r.reason)).toEqual(['not_in_nrmp', 'unknown_specialty']);
  });

  it('user-added programs stay private and unverified until an admin approves them', async () => {
    const { programs } = await importPrograms([row({ source: 'user' })], { geocoder, cbsa, createdByCouple: 'couple-1' });
    expect(programs[0]).toMatchObject({ createdByCouple: 'couple-1', verified: false });
  });
});

describe('CSV', () => {
  it('handles quotes, embedded commas, escaped quotes and CRLF', () => {
    const rows = parseCsv('name,city\r\n"Brigham and Women\'s, Boston","Boston"\r\n"Say ""hi""",X\r\n');
    expect(rows).toEqual([
      { name: "Brigham and Women's, Boston", city: 'Boston' },
      { name: 'Say "hi"', city: 'X' },
    ]);
  });
});
