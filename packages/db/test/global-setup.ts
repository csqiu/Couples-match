/**
 * Gives the tests a fresh database with the Supabase shim, every migration and
 * the seeds applied.
 *
 * - With DATABASE_URL (a superuser URL, e.g. `supabase start`'s
 *   postgresql://postgres:postgres@127.0.0.1:54322/postgres), a new database is
 *   created on that server and dropped afterwards.
 * - Without it, a throwaway Postgres cluster is started from the local
 *   PostgreSQL install (PostGIS required) and removed afterwards.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { chownSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    dbUrl: string;
  }
}

const SUPABASE = join(import.meta.dirname, '../../../supabase');

export function sqlFiles(): string[] {
  const migrations = readdirSync(join(SUPABASE, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(SUPABASE, 'migrations', f));
  return [
    join(SUPABASE, 'tests/supabase-shim.sql'),
    ...migrations,
    join(SUPABASE, 'seed/specialties.sql'),
    join(SUPABASE, 'seed/programs.sql'),
  ];
}

function pgBinDir(): string {
  const candidates: string[] = [];
  try {
    candidates.push(execFileSync('pg_config', ['--bindir'], { encoding: 'utf8' }).trim());
  } catch {
    // no pg_config on PATH
  }
  if (existsSync('/usr/lib/postgresql')) {
    for (const v of readdirSync('/usr/lib/postgresql').sort().reverse()) candidates.push(`/usr/lib/postgresql/${v}/bin`);
  }
  const dir = candidates.find((d) => existsSync(join(d, 'initdb')));
  if (!dir) throw new Error('No local PostgreSQL found. Install PostgreSQL + PostGIS, or set DATABASE_URL.');
  return dir;
}

async function startTempCluster(): Promise<{ url: string; stop: () => void }> {
  const bin = pgBinDir();
  const dir = mkdtempSync(join(tmpdir(), 'pairwise-pg-'));
  const asRoot = process.getuid?.() === 0;
  // Postgres refuses to run as root; use the postgres system user when we are root.
  const run = (cmd: string, args: string[]) => {
    const [file, argv] = asRoot ? ['runuser', ['-u', 'postgres', '--', join(bin, cmd), ...args]] : [join(bin, cmd), args];
    const r = spawnSync(file, argv, { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr || r.stdout}`);
  };
  if (asRoot) chownSync(dir, Number(execFileSync('id', ['-u', 'postgres'], { encoding: 'utf8' })), 0);
  const port = 55000 + Math.floor(Math.random() * 4000);
  run('initdb', ['-D', join(dir, 'data'), '-A', 'trust', '-U', 'postgres', '--no-sync']);
  run('pg_ctl', ['-D', join(dir, 'data'), '-w', '-l', join(dir, 'log'), '-o', `-p ${port} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off`, 'start']);
  return {
    url: `postgresql://postgres@127.0.0.1:${port}/postgres`,
    stop: () => {
      try {
        run('pg_ctl', ['-D', join(dir, 'data'), '-m', 'immediate', 'stop']);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

export default async function setup(project: TestProject) {
  let serverUrl = process.env.DATABASE_URL;
  let stop = () => {};
  if (!serverUrl) ({ url: serverUrl, stop } = await startTempCluster());

  const dbName = `pairwise_test_${process.pid}_${Date.now()}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`create database ${dbName}`);
  await admin.end();

  const url = new URL(serverUrl);
  url.pathname = `/${dbName}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  for (const file of sqlFiles()) {
    try {
      await db.query(readFileSync(file, 'utf8'));
    } catch (e) {
      throw new Error(`Applying ${file.replace(SUPABASE, 'supabase')}: ${(e as Error).message}`);
    }
  }
  await db.end();
  project.provide('dbUrl', url.toString());

  return async () => {
    const a = new pg.Client({ connectionString: serverUrl });
    await a.connect();
    await a.query(`drop database if exists ${dbName} with (force)`);
    await a.end();
    stop();
  };
}
