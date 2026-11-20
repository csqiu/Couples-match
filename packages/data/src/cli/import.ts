/**
 * Imports a staging CSV into normalized programs + an admin review queue.
 *
 *   pnpm --filter @pairwise/data import <staging.csv> [--out out/] [--cbsa cbsa.geojson] [--source name]
 *
 * CSV columns: name, institution, specialty, street, city, state, zip, acgme_id, is_advanced, source_id
 * Geocodes are cached in .cache/geocode.json so re-runs never re-query an address.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CbsaIndex } from '../cbsa';
import { parseCsv } from '../csv';
import { defaultGeocoder, type GeocodeResult } from '../geocode';
import { importPrograms } from '../pipeline';
import type { StagingRow } from '../types';

const args = process.argv.slice(2);
const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const flag = (n: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!file) {
  console.error('Usage: import <staging.csv> [--out dir] [--cbsa boundaries.geojson] [--source name]');
  process.exit(1);
}

const source = flag('source') ?? file.replace(/^.*\//, '').replace(/\.csv$/, '');
const rows: StagingRow[] = parseCsv(readFileSync(file, 'utf8')).map((r) => ({
  source,
  sourceId: r.source_id || undefined,
  name: r.name,
  institution: r.institution || r.name,
  specialty: r.specialty,
  street: r.street,
  city: r.city,
  state: r.state,
  zip: r.zip || undefined,
  acgmeId: r.acgme_id || undefined,
  isAdvanced: /^(1|true|yes|y)$/i.test(r.is_advanced ?? ''),
}));

const cachePath = '.cache/geocode.json';
const cache = new Map<string, GeocodeResult | null>(
  existsSync(cachePath) ? Object.entries(JSON.parse(readFileSync(cachePath, 'utf8'))) : [],
);
const cbsaPath = flag('cbsa');
const cbsa = cbsaPath ? CbsaIndex.fromGeoJSON(JSON.parse(readFileSync(cbsaPath, 'utf8')), { metroOnly: false }) : undefined;

const result = await importPrograms(rows, { geocoder: defaultGeocoder(cache), cbsa });

mkdirSync(dirname(cachePath), { recursive: true });
writeFileSync(cachePath, JSON.stringify(Object.fromEntries(cache), null, 2));
const out = flag('out') ?? 'out';
mkdirSync(out, { recursive: true });
for (const [name, data] of Object.entries(result)) writeFileSync(join(out, `${name}.json`), JSON.stringify(data, null, 2));
console.log(
  `${rows.length} rows → ${result.programs.length} programs, ${result.review.length} for review, ${result.rejected.length} rejected (written to ${out}/)`,
);
