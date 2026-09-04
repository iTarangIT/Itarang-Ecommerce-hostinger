import pg, { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { connectionOptions } from './connection';

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
 * The guard runs inside `connectionOptions()` before the pool is constructed,
 * so a misconfigured `DATABASE_URL` throws before any connection is opened.
 * See `guard.ts` and `connection.ts`.
 *
 * Server-only. Importing this from a client component is a build error, which
 * is the intent — no database credential can reach the browser.
 */

let pool: Pool | null = null;

/**
 * How many connections this process may hold.
 *
 * The third case is the one worth explaining. `next build` forks a prerender
 * worker per CPU, and each worker is its own process with its own pool — so the
 * ceiling is `max × workers`, not `max`. That never mattered while the
 * catalogue came from an HTTP API, because a build opened no connections at
 * all. It matters now: with `COMMERCE_PROVIDER=db`, every prerendered product
 * page, category page and sitemap entry reads Postgres.
 *
 * Supabase's session-mode pooler allows 15 clients. Eight workers holding five
 * each is 40, and the build dies with
 * `EMAXCONNSESSION: max clients reached in session mode`, part-way through
 * prerendering, with nothing to suggest the cause is a pool size.
 *
 * A build worker renders pages one at a time and every provider caches its
 * catalogue snapshot per process, so one connection per worker is genuinely
 * enough — the pool exists for concurrent *requests*, which a build does not
 * have.
 */
function poolSize(remote: boolean): number {
  if (process.env.NEXT_PHASE === 'phase-production-build') return 1;
  return remote ? 5 : 10;
}

export function db(): Pool {
  if (pool) return pool;

  const { info, connectionString, ssl } = connectionOptions();

  pool = new Pool({
    connectionString,
    ssl,
    // A managed database is a shared, capped resource, and `next dev` can hold
    // several pools at once across HMR reloads. Local Postgres has no such
    // pressure. During a build the limit is per worker — see `poolSize`.
    max: poolSize(info.remote),
    idleTimeoutMillis: 30_000,
    // Every connection is now an internet round-trip rather than a loopback,
    // and a pooler may queue before handing one over.
    connectionTimeoutMillis: info.remote ? 15_000 : 5_000,
    // A checkout query that hangs is worse than one that fails.
    statement_timeout: 10_000,
    /**
     * The same rule, enforced on this side of the socket.
     *
     * `statement_timeout` above is a *server* setting: Postgres cancels the
     * query and sends back an error. That works whenever the server can still
     * be heard from — and does nothing at all when it cannot. A connection that
     * was established, checked out, and then lost without a FIN (a sleeping
     * laptop, a flapping link, a pooler that drops the socket) leaves `pg`
     * waiting on a reply that will never come, with no timer of its own. The
     * promise never settles, so nothing throws, so no error boundary is ever
     * reached and a page suspended on that query stays on its skeleton for as
     * long as the tab is open. That is the failure this line closes.
     *
     * Two seconds above `statement_timeout`, deliberately. Any query the server
     * is still able to answer has already been cancelled by the server at 10s
     * and reported as an error, so this can only ever fire for a query that
     * received no answer at all. It cannot pre-empt a slow-but-live query or
     * change the outcome of one, which is what makes it safe to apply to every
     * caller — checkout included — rather than only to the page that exposed it.
     */
    query_timeout: 12_000,
  });

  pool.on('error', (error) => {
    console.error('[db] idle client error', error.message);
  });

  // Safe to log: the redacted form never contains the password.
  console.info(`[db] connected to ${info.redacted} (${info.remote ? 'remote' : 'local'})`);

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
