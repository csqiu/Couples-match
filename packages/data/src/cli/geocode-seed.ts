/**
 * Re-geocodes every seed program and reports how far each hand-entered point is
 * from the geocoder's answer. Needs network access to the Census geocoder
 * (and Nominatim as fallback).
 *
 *   pnpm --filter @pairwise/data geocode:seed [--write]
 *
 * --write updates seed/programs.json with the geocoded points (and their source
 * and confidence) where the geocoder is confident.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { haversineMi } from '@pairwise/engine';
import { defaultGeocoder } from '../geocode';
import { GEOCODE_REVIEW_THRESHOLD } from '../pipeline';
import type { ProgramRecord } from '../types';

const path = new URL('../../seed/programs.json', import.meta.url);
const doc = JSON.parse(readFileSync(path, 'utf8')) as { programs: ProgramRecord[] };
const write = process.argv.includes('--write');
const geocoder = defaultGeocoder();
let changed = 0;

for (const p of doc.programs) {
  const [street, city, stateZip] = p.address.split(',').map((s) => s.trim());
  const [state, zip] = stateZip.split(' ');
  const g = await geocoder.geocode({ street, city, state, zip }).catch((e: Error) => {
    console.log(`  ${p.id}: error ${e.message}`);
    return null;
  });
  if (!g) {
    console.log(`  ${p.id}: no result`);
    continue;
  }
  const drift = haversineMi({ lat: p.lat!, lon: p.lon! }, g);
  const flag = drift > 0.5 ? '  ← check' : '';
  console.log(`  ${p.id}: ${drift.toFixed(2)} mi (${g.source}, confidence ${g.confidence})${flag}`);
  if (write && g.confidence >= GEOCODE_REVIEW_THRESHOLD) {
    Object.assign(p, { lat: g.lat, lon: g.lon, geocodeSource: g.source, geocodeConfidence: g.confidence });
    changed++;
  }
}
if (write) {
  writeFileSync(path, JSON.stringify(doc, null, 2) + '\n');
  console.log(`Updated ${changed} program(s).`);
}
