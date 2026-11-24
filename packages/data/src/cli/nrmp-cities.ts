/**
 * Finds every city in the NRMP directory CSV on the map (OpenStreetMap,
 * one request a second) and saves the answers to seed/nrmp-cities.json.
 * Cities already in that file are skipped, so it can be re-run safely.
 *
 *   pnpm --filter @pairwise/data nrmp:cities <nrmp_main_match_programs.csv>
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from '../csv';
import { throttle } from '../geocode';
import { directoryCity } from '../nrmp-directory';
import { stateAbbreviation } from '../us-states';

export interface CityPoint {
  lat: number;
  lon: number;
  /** What OpenStreetMap matched, for checking. */
  matched: string;
}

const file = process.argv[2];
if (!file) throw new Error('Usage: nrmp:cities <csv>');
const out = new URL('../../seed/nrmp-cities.json', import.meta.url);
const cities: Record<string, CityPoint | null> = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
const rows = parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
const wanted = [...new Set(rows.map((r) => `${directoryCity(r['City'], stateAbbreviation(r['State'])!)}, ${stateAbbreviation(r['State'])}`))].sort();
// Forget cities no longer wanted (e.g. a typo that's now corrected).
for (const k of Object.keys(cities)) if (!wanted.includes(k)) delete cities[k];
const todo = wanted.filter((k) => !(k in cities));
console.log(`${wanted.length} cities, ${todo.length} to look up`);

const wait = throttle(1100);
let n = 0;
for (const key of todo) {
  const [city, state] = key.split(', ');
  const stateName = rows.find((r) => stateAbbreviation(r['State']) === state)!['State'];
  await wait();
  const params = new URLSearchParams({ city, state: stateName, format: 'jsonv2', countrycodes: 'us,pr', limit: '1' });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'User-Agent': 'pairwise-program-import/0.1' } });
    const hits = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    cities[key] = hits[0] ? { lat: Number(hits[0].lat), lon: Number(hits[0].lon), matched: hits[0].display_name } : null;
  } catch (e) {
    console.log(`  ${key}: ${(e as Error).message}`);
    continue; // not cached: retried next run
  }
  if (++n % 25 === 0) {
    writeFileSync(out, JSON.stringify(cities, null, 1) + '\n');
    console.log(`  ${n}/${todo.length}`);
  }
}
const sorted = Object.fromEntries(Object.entries(cities).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(out, JSON.stringify(sorted, null, 1) + '\n');
console.log(`Done. ${Object.values(sorted).filter((v) => !v).length} not found.`);
