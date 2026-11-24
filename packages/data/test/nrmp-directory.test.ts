import { describe, expect, it } from 'vitest';
import { applySeedPositions, directoryCity, directoryToPrograms, institutionName, type DirectoryRow } from '../src/nrmp-directory';
import { SEED_PROGRAMS } from '../src/seed';
import { stateAbbreviation, tidyCity } from '../src/us-states';

const row = (over: Partial<DirectoryRow>): DirectoryRow => ({
  Specialty: 'Internal Medicine',
  'Program Name': 'MGB-Massachusetts Gen Hosp-MA',
  City: 'BOSTON',
  State: 'Massachusetts',
  'Program Status': 'Active',
  'NRMP Code': '1261140C0',
  'ACGME Code': '1402411130',
  ...over,
});
const cities = { 'Boston, MA': { lat: 42.36, lon: -71.06 } };

describe('NRMP directory import', () => {
  it('turns a directory row into a program with its NRMP code and a city-level location', () => {
    const { programs, skipped } = directoryToPrograms([row({})], cities);
    expect(skipped).toEqual([]);
    expect(programs[0]).toMatchObject({
      id: 'nrmp-1261140C0',
      name: 'MGB-Massachusetts Gen Hosp — Internal Medicine',
      institution: 'MGB-Massachusetts Gen Hosp',
      specialtyCode: 'internal-medicine',
      nrmpCode: '1261140C0',
      acgmeId: '1402411130',
      city: 'Boston',
      state: 'MA',
      lat: 42.36,
      geocodeConfidence: 0.5,
      verified: true,
      isAdvanced: false,
    });
  });

  it('names tracks, files preliminary medicine and surgery under their own specialties, and flags advanced', () => {
    const { programs } = directoryToPrograms(
      [
        row({ 'NRMP Code': '1261140P0' }),
        row({ Specialty: 'Surgery-General', 'NRMP Code': '1261440P1' }),
        row({ Specialty: 'Dermatology', 'NRMP Code': '1261080A0' }),
        row({ Specialty: 'Anesthesiology', 'NRMP Code': '1261040R0' }),
        row({ 'NRMP Code': '1261140C2' }),
        row({ 'NRMP Code': '1261140C10' }),
        row({ Specialty: 'Pediatrics', 'NRMP Code': '1261320P0' }),
      ],
      cities,
    );
    expect(programs.map((p) => [p.specialtyCode, p.name.split(' — ')[1]])).toEqual([
      ['preliminary-medicine', 'Internal Medicine - Preliminary'],
      ['preliminary-surgery', 'Surgery - Preliminary (track 2)'],
      ['dermatology', 'Dermatology (Advanced)'],
      ['anesthesiology', 'Anesthesiology (Physician only)'],
      ['internal-medicine', 'Internal Medicine (track 3)'],
      ['internal-medicine', 'Internal Medicine (track 11)'],
      ['pediatrics', 'Pediatrics (Preliminary)'],
    ]);
    expect(programs[2].isAdvanced).toBe(true);
  });

  it('leaves out withdrawn and non-participating tracks, and says why rows were skipped', () => {
    const { programs, skipped } = directoryToPrograms(
      [
        row({ 'Program Status': 'Withdrawn' }),
        row({ 'Program Status': 'Not Participating' }),
        row({ 'Program Status': 'Initial', 'NRMP Code': '1261140C1' }),
        row({ Specialty: 'Underwater Basket Weaving', 'NRMP Code': '1261999C0' }),
        row({ 'NRMP Code': 'nope' }),
      ],
      {},
    );
    expect(programs.map((p) => p.id)).toEqual(['nrmp-1261140C1']);
    expect(programs[0].lat).toBeNull();
    expect(skipped.map((s) => s.reason)).toEqual(['not_rankable', 'not_rankable', 'unknown_specialty', 'bad_code']);
  });

  it('cleans names, cities and states', () => {
    expect(institutionName('Univ of Alabama Hospital-Birmingham-AL', 'Birmingham', 'AL')).toBe('Univ of Alabama Hospital');
    expect(institutionName('Temple Univ Hosp-PA', 'PHILADELPHIA', 'PA')).toBe('Temple Univ Hosp');
    expect(institutionName('Zucker SOM-Northwell Lenox Hill Hosp-NY', 'New York', 'NY')).toBe('Zucker SOM-Northwell Lenox Hill Hosp');
    expect(tidyCity('LOS ANGELES')).toBe('Los Angeles');
    expect(tidyCity('WINSTON-SALEM')).toBe('Winston-Salem');
    expect(tidyCity('La Jolla')).toBe('La Jolla');
    expect(directoryCity('Cincinnnati', 'OH')).toBe('Cincinnati');
    expect(directoryCity('.', 'CT')).toBe('New Haven');
    expect(directoryCity('7346474144', 'MI')).toBe('Ann Arbor');
    expect(stateAbbreviation('District Of Columbia')).toBe('DC');
    expect(stateAbbreviation('Puerto Rico')).toBe('PR');
  });

  it('gives every track at a seed program’s hospital that hospital’s exact position', () => {
    const { programs } = directoryToPrograms(
      [row({}), row({ Specialty: 'Psychiatry', 'NRMP Code': '1261400C0' }), row({ 'Program Name': 'Tufts Medical Center-MA', 'NRMP Code': '1263140C0' })],
      cities,
    );
    const mgh = SEED_PROGRAMS.find((p) => p.id === 'seed-mgh-internal-medicine')!;
    expect(applySeedPositions(programs, [mgh], { 'seed-mgh-internal-medicine': '1261140C0' })).toBe(2);
    expect(programs[0]).toMatchObject({ lat: mgh.lat, lon: mgh.lon, address: mgh.address });
    expect(programs[1].lat).toBe(mgh.lat); // MGH psychiatry too
    expect(programs[2].lat).toBe(42.36); // Tufts keeps the city centre
  });
});
