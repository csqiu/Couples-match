import { describe, expect, it } from 'vitest';
import { buildQueue, nameSimilarity, parseAddress, reasonsFor, type ReviewProgram } from './admin-review';

const prog = (id: string, over: Partial<ReviewProgram> = {}): ReviewProgram => ({
  id,
  name: `Program ${id}`,
  institution: 'Inst',
  specialty_code: 'internal-medicine',
  specialty_name: 'Internal Medicine',
  city: 'Boston',
  state: 'MA',
  address: '55 Fruit St, Boston, MA 02114',
  lat: 42.36,
  lon: -71.07,
  geocode_confidence: 0.95,
  geocode_source: 'census',
  source: 'seed',
  verified: false,
  created_by_couple: null,
  created_at: '2026-11-01T00:00:00Z',
  ...over,
});

describe('admin review queue', () => {
  it('flags couple-added, missing or doubtful locations, and duplicates', () => {
    expect(reasonsFor(prog('a'), new Set())).toEqual([]);
    expect(reasonsFor(prog('a', { created_by_couple: 'c1' }), new Set())).toEqual(['added_by_couple']);
    expect(reasonsFor(prog('a', { lat: null, lon: null }), new Set())).toEqual(['no_location']);
    expect(reasonsFor(prog('a', { geocode_confidence: 0.6 }), new Set())).toEqual(['low_confidence']);
    expect(reasonsFor(prog('a'), new Set(['a']))).toEqual(['possible_duplicate']);
  });

  it('puts couples’ programs first and routine imports in their own group', () => {
    const items = [
      prog('old-import', { geocode_confidence: 0.5, created_at: '2026-01-01T00:00:00Z' }),
      prog('couple', { created_by_couple: 'c1', created_at: '2026-06-01T00:00:00Z' }),
      prog('fine'),
      prog('dup'),
    ];
    const verified = prog('real', { verified: true, name: 'Program dup' });
    const byId = new Map([...items, verified].map((p) => [p.id, p]));
    const q = buildQueue(items, [{ program_a: 'dup', program_b: 'real', distance_mi: 0.01 }], byId);
    expect(q.duplicates.map((d) => [d.a.id, d.b.id])).toEqual([['dup', 'real']]);
    expect(q.attention.map((x) => x.program.id)).toEqual(['couple', 'old-import', 'dup']);
    expect(q.routine.map((p) => p.id)).toEqual(['fine']);
  });

  it('ignores different hospitals on the same campus', () => {
    const a = prog('a', { name: 'Houston Methodist Hospital — Internal Medicine', institution: 'Houston Methodist Hospital' });
    const b = prog('b', { name: 'Baylor College of Medicine — Internal Medicine', institution: 'Baylor College of Medicine' });
    const c = prog('c', { name: 'Methodist Hospital Houston IM', institution: 'Houston Methodist' });
    const byId = new Map([a, b, c].map((p) => [p.id, p]));
    const q = buildQueue([a, b, c], [
      { program_a: 'a', program_b: 'b', distance_mi: 0.4 },
      { program_a: 'a', program_b: 'c', distance_mi: 0.4 },
      { program_a: 'b', program_b: 'c', distance_mi: 0.05 },
    ], byId);
    expect(q.duplicates.map((d) => `${d.a.id}${d.b.id}`)).toEqual(['ac', 'bc']);
  });

  it('compares names and splits stored addresses', () => {
    expect(nameSimilarity('Massachusetts General Hospital Internal Medicine', 'Mass General Internal Medicine Program')).toBeGreaterThan(0.4);
    expect(nameSimilarity('Johns Hopkins Pediatrics', 'Stanford Surgery')).toBe(0);
    expect(parseAddress(prog('a'))).toEqual({ street: '55 Fruit St', city: 'Boston', state: 'MA', zip: '02114' });
    expect(parseAddress({ address: 'Boston, MA', city: 'Boston', state: 'MA' })).toEqual({ street: '', city: 'Boston', state: 'MA', zip: undefined });
  });
});
