/**
 * Loads the NRMP Main Match directory into the database, as an admin.
 *
 *   pnpm --filter @pairwise/data nrmp:load [--dry-run]
 *
 * Reads nrmp-directory/nrmp_main_match_programs.csv and seed/nrmp-cities.json
 * (run nrmp:cities first). It then:
 *   1. builds one program per rankable NRMP track (Active or Initial), with
 *      exact hospital positions where a seed program gives one;
 *   2. saves them through import_programs (admin-only), in batches; re-running
 *      updates programs in place and never overwrites a location an admin set by hand;
 *   3. merges each seed program into its NRMP track (seed/nrmp-seed-map.json), so
 *      couples who listed a seed program keep their place, answers and codes.
 *
 * Needs, in the environment (or apps/web/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
 *   PAIRWISE_ADMIN_EMAIL, PAIRWISE_ADMIN_PASSWORD  (an account with profiles.is_admin)
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseCsv } from '../csv';
import { applySeedPositions, directoryToPrograms, type CityPoint, type DirectoryRow } from '../nrmp-directory';
import { SEED_PROGRAMS } from '../seed';

const root = new URL('../../../../', import.meta.url);
const dryRun = process.argv.includes('--dry-run');
const BATCH = 1000;

function env(): Record<string, string> {
  const file = new URL('apps/web/.env.local', root);
  const local = existsSync(file)
    ? Object.fromEntries(
        readFileSync(file, 'utf8')
          .split('\n')
          .filter((l) => l.includes('=') && !l.startsWith('#'))
          .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
      )
    : {};
  return { ...local, ...(process.env as Record<string, string>) };
}

const rows = parseCsv(readFileSync(new URL('nrmp-directory/nrmp_main_match_programs.csv', root), 'utf8').replace(/^﻿/, '')) as unknown as DirectoryRow[];
const cities = JSON.parse(readFileSync(new URL('../../seed/nrmp-cities.json', import.meta.url), 'utf8')) as Record<string, CityPoint | null>;
const seedMap = JSON.parse(readFileSync(new URL('../../seed/nrmp-seed-map.json', import.meta.url), 'utf8')) as Record<string, string>;
delete seedMap._comment;

const { programs, skipped } = directoryToPrograms(rows, cities);
const exact = applySeedPositions(programs, SEED_PROGRAMS, seedMap);
const noLocation = programs.filter((p) => p.lat == null);
const reasons = skipped.reduce<Record<string, number>>((acc, s) => ((acc[`${s.reason}${s.detail ? ` (${s.detail})` : ''}`] = (acc[`${s.reason}${s.detail ? ` (${s.detail})` : ''}`] ?? 0) + 1), acc), {});
console.log(`${rows.length} directory rows → ${programs.length} programs`);
console.log(`  skipped: ${JSON.stringify(reasons)}`);
console.log(`  exact hospital position (from seed programs): ${exact}`);
console.log(`  city-level position: ${programs.length - exact - noLocation.length}`);
console.log(`  no position (city not found): ${noLocation.length}${noLocation.length ? ` e.g. ${noLocation.slice(0, 3).map((p) => `${p.city}, ${p.state}`).join('; ')}` : ''}`);
if (dryRun) process.exit(0);

const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL;
// The publishable key goes on the apikey header only (it isn't a JWT); the admin's session goes on Authorization.
const anon = e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !anon || !e.PAIRWISE_ADMIN_EMAIL || !e.PAIRWISE_ADMIN_PASSWORD) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, PAIRWISE_ADMIN_EMAIL and PAIRWISE_ADMIN_PASSWORD.');
}

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: e.PAIRWISE_ADMIN_EMAIL, password: e.PAIRWISE_ADMIN_PASSWORD }),
});
if (!auth.ok) throw new Error(`Sign-in failed: ${auth.status} ${await auth.text()}`);
const { access_token: token } = (await auth.json()) as { access_token: string };

async function rpc<T>(name: string, body: unknown): Promise<T> {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw Object.assign(new Error(`${name}: ${res.status} ${text}`), { body: text });
  return (text ? JSON.parse(text) : null) as T;
}

let inserted = 0;
let updated = 0;
for (let i = 0; i < programs.length; i += BATCH) {
  const [r] = await rpc<Array<{ inserted: number; updated: number }>>('import_programs', { p_programs: programs.slice(i, i + BATCH) });
  inserted += r.inserted;
  updated += r.updated;
  console.log(`  saved ${Math.min(i + BATCH, programs.length)}/${programs.length}`);
}
console.log(`Programs: ${inserted} new, ${updated} updated.`);

let merged = 0;
for (const [seed, code] of Object.entries(seedMap)) {
  try {
    await rpc('merge_programs', { p_from: seed, p_to: `nrmp-${code}` });
    merged++;
  } catch (err) {
    // Already merged on an earlier run.
    if (!String((err as { body?: string }).body).includes('program_not_found')) throw err;
  }
}
console.log(`Seed programs merged into their NRMP tracks: ${merged} (the rest were merged on an earlier run).`);
