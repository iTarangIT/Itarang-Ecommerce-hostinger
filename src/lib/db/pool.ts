import pg, { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { assertLocalDatabase } from './guard';

/**
 * `bigint` (oid 20) arrives as a string by default, because Postgres bigint is
 * wider than a JS number. Every bigint in this schema is a paise amount or a
 * row id, both far below Number.MAX_SAFE_INTEGER (₹90,071,992,547 in paise), so
 * parsing to a number is safe and spares every call site a manual conversion.
 */
pg.types.setTypeParser(20, (value) => Number(value));
/** `numeric` (oid 1700) — used only for tax rates here. */
pg.types.setTypeParser(1700, (value) => Number(value));

/**
 * PostgreSQL connection pool.
 *
 * `assertLocalDatabase` runs before the pool is constructed, so a misconfigured
 * `DATABASE_URL` throws before any connection is opened. See `guard.ts`.
 *
 * Server-only. Importing this from a client component is a build error, which
 * is the intent — no database credential can reach the browser.
 */

let pool: Pool | null = null;

export function db(): Pool {
  if (pool) return pool;

  const info = assertLocalDatabase(process.env.DATABASE_URL);

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    // A checkout query that hangs is worse than one that fails.
    statement_timeout: 10_000,
  });

  pool.on('error', (error) => {
    console.error('[db] idle client error', error.message);
  });

  // Safe to log: the redacted form never contains the password.
  console.info(`[db] connected to ${info.redacted}`);

  return pool;
}

/** Typed single-statement query. */
export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db().query<T>(text, params);
  return result.rows;
}

/** Exactly one row, or null. */
export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run a unit of work inside a transaction.
 *
 * Order creation and stock reservation share one transaction so a reservation
 * can never exist without its order, and two concurrent checkouts cannot both
 * take the last unit — the reservation read inside uses `FOR UPDATE`.
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {
      /* the original error is the one worth surfacing */
    });
    throw error;
  } finally {
    client.release();
  }
}

/** Close the pool — used by scripts and test teardown. */
export async function closePool(): Promise<void> {
  if (!pool) return;
  await pool.end();
  pool = null;
}
