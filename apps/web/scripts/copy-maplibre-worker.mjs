// Serves MapLibre's web-worker files from /maplibre/ so the map can start its
// worker (bundlers can't follow MapLibre's worker URL). Runs before dev/build,
// so the files always match the installed version.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve('maplibre-gl/package.json')), 'dist');
const out = new URL('../public/maplibre/', import.meta.url);
mkdirSync(out, { recursive: true });
for (const f of readdirSync(dist).filter((f) => /^maplibre-gl-(worker|shared)\.mjs$/.test(f))) {
  copyFileSync(join(dist, f), new URL(f, out));
}
