/**
 * Test helpers. Each test runs inside a transaction that is rolled back, so
 * tests never see each other's data. `as(user)` switches to the `authenticated`
 * role with that user's JWT claims — exactly what PostgREST does per request —
 * so row level security applies just as it would from the app.
 */
import pg from 'pg';
import { inject } from 'vitest';

const pool = new pg.Pool({ connectionString: inject('dbUrl'), max: 4 });

export interface User {
  id: string;
  email: string;
}

export class Db {
  private savepoints = 0;
  constructor(private client: pg.PoolClient) {}

  async query<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    return (await this.client.query<T>(sql, params)).rows;
  }

  async one<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = []) {
    const rows = await this.query<T>(sql, params);
    if (rows.length !== 1) throw new Error(`Expected one row, got ${rows.length}: ${sql}`);
    return rows[0];
  }

  /** Back to the superuser (bypasses RLS) — for setting up fixtures. */
  async asAdmin() {
    await this.client.query('reset role');
    await this.client.query("select set_config('request.jwt.claims', '', true)");
  }

  /** Act as a signed-in user (or anonymous, with null). */
  async as(user: User | null) {
    await this.asAdmin();
    if (user) {
      await this.client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated' }),
      ]);
      await this.client.query('set local role authenticated');
    } else {
      await this.client.query('set local role anon');
    }
  }

  /** Act as the service role (server-side jobs). */
  async asService() {
    await this.asAdmin();
    await this.client.query('set local role service_role');
  }

  async createUser(email: string, opts: { specialty?: string; admin?: boolean; name?: string } = {}): Promise<User> {
    await this.asAdmin();
    const { id } = await this.one<{ id: string }>('insert into auth.users (email) values ($1) returning id', [email]);
    if (opts.specialty || opts.admin || opts.name) {
      await this.query('update public.profiles set specialty = $2, is_admin = $3, display_name = coalesce($4, display_name) where user_id = $1', [
        id,
        opts.specialty ?? null,
        !!opts.admin,
        opts.name ?? null,
      ]);
    }
    return { id, email };
  }

  /** Runs a statement that must fail; returns the error message (the transaction stays usable). */
  async error(sql: string, params: unknown[] = []): Promise<string> {
    const sp = `sp${++this.savepoints}`;
    await this.client.query(`savepoint ${sp}`);
    try {
      await this.client.query(sql, params);
    } catch (e) {
      await this.client.query(`rollback to savepoint ${sp}`);
      return (e as Error).message;
    }
    await this.client.query(`release savepoint ${sp}`);
    throw new Error(`Expected an error from: ${sql}`);
  }
}

export async function tx(fn: (db: Db) => Promise<void>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await fn(new Db(client));
  } finally {
    await client.query('rollback').catch(() => {});
    client.release();
  }
}

/** A couple where A invited B and B accepted. */
export async function activeCouple(db: Db, opts: { year?: number; aSpecialty?: string; bSpecialty?: string } = {}) {
  const a = await db.createUser(`a-${Math.random().toString(36).slice(2)}@example.com`, {
    specialty: opts.aSpecialty ?? 'internal-medicine',
    name: 'Alex',
  });
  const b = await db.createUser(`b-${Math.random().toString(36).slice(2)}@example.com`, {
    specialty: opts.bSpecialty ?? 'pediatrics',
    name: 'Sam',
  });
  await db.as(a);
  const { id: coupleId } = await db.one<{ id: string }>(
    `insert into couples (partner_a, match_type, match_name, match_year)
     values ($1, 'main', 'Main Residency Match', $2) returning id`,
    [a.id, opts.year ?? 2027],
  );
  const { token } = await db.one<{ token: string }>('select token from create_invite($1, $2)', [coupleId, b.email]);
  await db.as(b);
  await db.one('select accept_invite($1)', [token]);
  return { a, b, coupleId, token };
}
