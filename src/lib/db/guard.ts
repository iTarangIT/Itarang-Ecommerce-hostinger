/**
 * Database safety guard.
 *
 * This project owns exactly two possible targets and must never touch anything
 * else:
 *
 *   local   `itarang_dev` on this machine — offline development and the
 *           integration test suite.
 *   remote  ONE explicitly named managed database (Supabase), and only when
 *           `DB_ALLOW_REMOTE=true` and `DB_REMOTE_HOST` names the exact host.
 *
 * The remote path is deliberately awkward. Widening it took an edit to this
 * file, and using it still takes two environment variables set on purpose — a
 * stray or mistyped `DATABASE_URL` cannot reach a database nobody approved.
 *
 * `tarang_dev` belongs to a different application and differs from our database
 * name by a single leading character, which is precisely the kind of typo a
 * host-only check would wave through. It is therefore named in an explicit
 * denylist as well as being excluded by the exact-name rule.
 *
 * Every database entry point — the connection pool and all `db:*` scripts —
 * calls `assertProjectDatabase()` **before opening a connection**, so a
 * misconfigured URL aborts before a single statement is issued.
 *
 * Environment is read from `process.env` directly rather than through
 * `src/lib/env.ts`, because `scripts/db.mts` runs outside the application and
 * must not be made to satisfy the full application schema to migrate a table.
 *
 * Loosening any of this must be a deliberate, reviewable edit to this file.
 */

/** The only database this project may connect to on a local host. */
export const EXPECTED_DATABASE = 'itarang_dev';

/** The database name a managed provider is expected to use, unless overridden. */
export const DEFAULT_REMOTE_DATABASE = 'postgres';

/** Hosts considered local. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Databases that are never a valid target, on any host.
 *
 * `tarang_dev` is another application's database. The `template*` databases are
 * PostgreSQL's own. `postgres` is absent here deliberately: it is the local
 * maintenance database (refused below by the exact-name rule) but it is also
 * the real, only database a Supabase project exposes.
 */
const FORBIDDEN_DATABASES = new Set(['tarang_dev', 'template0', 'template1']);

/** True for the loopback hosts this project treats as local. */
export function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host);
}

export class DatabaseGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseGuardError';
  }
}

export interface InspectedDatabaseUrl {
  host: string;
  port: string;
  database: string;
  user: string;
  /** True when the approved remote target is in use, false for local. */
  remote: boolean;
  /** Safe to log — credentials removed. */
  redacted: string;
}

/**
 * Parse a connection string without ever exposing the password.
 * Throws `DatabaseGuardError` on anything unparseable.
 */
export function inspectDatabaseUrl(raw: string): Omit<InspectedDatabaseUrl, 'remote'> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new DatabaseGuardError('DATABASE_URL is not a valid connection string.');
  }

  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new DatabaseGuardError(
      `DATABASE_URL must be a postgres:// connection string (got "${url.protocol}//").`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const host = url.hostname;
  const port = url.port || '5432';
  const user = decodeURIComponent(url.username || '');

  return {
    host,
    port,
    database,
    user,
    // Password is never included, so this string is safe in logs and errors.
    redacted: `postgresql://${user ? `${user}@` : ''}${host}:${port}/${database}`,
  };
}

/** `sslmode` from the query string, or undefined. */
function sslModeOf(raw: string): string | undefined {
  try {
    return new URL(raw).searchParams.get('sslmode') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Refuse to proceed unless the URL points at a database this project owns:
 * the local `itarang_dev`, or the one approved remote target.
 *
 * Returns the inspected URL so callers can log it safely and branch on
 * `remote` for SSL and destructive-command interlocks.
 */
export function assertProjectDatabase(raw: string | undefined): InspectedDatabaseUrl {
  if (!raw) {
    throw new DatabaseGuardError(
      'DATABASE_URL is not set. Copy .env.example to .env.local and point it at ' +
        `a local ${EXPECTED_DATABASE} database, or at the approved remote database.`,
    );
  }

  const info = inspectDatabaseUrl(raw);

  // 1. Never valid anywhere, checked first so the message names the actual
  //    problem rather than a generic name mismatch.
  if (FORBIDDEN_DATABASES.has(info.database)) {
    throw new DatabaseGuardError(
      `Refusing to connect: database "${info.database}" belongs to another ` +
        `application (or is a system database). This project may only use ` +
        `"${EXPECTED_DATABASE}" locally, or the approved remote database.`,
    );
  }

  // 2. Local: unchanged behaviour — exactly one database, by name.
  if (LOCAL_HOSTS.has(info.host)) {
    if (info.database !== EXPECTED_DATABASE) {
      throw new DatabaseGuardError(
        `Refusing to connect: expected database "${EXPECTED_DATABASE}" but ` +
          `DATABASE_URL names "${info.database}".`,
      );
    }
    return { ...info, remote: false };
  }

  // 3. Remote: allowed only when switched on explicitly, and only for the one
  //    host named in the environment.
  if (process.env.DB_ALLOW_REMOTE !== 'true') {
    throw new DatabaseGuardError(
      `Refusing to connect: DATABASE_URL points at remote host "${info.host}", ` +
        'but DB_ALLOW_REMOTE is not set to "true". No remote database may be ' +
        'used without it.',
    );
  }

  const approvedHost = process.env.DB_REMOTE_HOST;
  if (!approvedHost) {
    throw new DatabaseGuardError(
      'Refusing to connect: DB_ALLOW_REMOTE=true requires DB_REMOTE_HOST to name ' +
        'the exact host that is approved. Set it alongside DATABASE_URL.',
    );
  }

  // Exact match, so a mistyped or swapped host aborts before connecting even
  // though remote connections are switched on.
  if (info.host !== approvedHost) {
    throw new DatabaseGuardError(
      `Refusing to connect: DATABASE_URL points at host "${info.host}" but ` +
        `DB_REMOTE_HOST approves only "${approvedHost}".`,
    );
  }

  const approvedDatabase = process.env.DB_REMOTE_DATABASE || DEFAULT_REMOTE_DATABASE;
  if (info.database !== approvedDatabase) {
    throw new DatabaseGuardError(
      `Refusing to connect: expected remote database "${approvedDatabase}" but ` +
        `DATABASE_URL names "${info.database}".`,
    );
  }

  // Customer names, phone numbers and addresses cross the public internet on
  // this connection. An unencrypted one is not an option.
  if (sslModeOf(raw) !== 'require') {
    throw new DatabaseGuardError(
      'Refusing to connect: a remote DATABASE_URL must carry "?sslmode=require". ' +
        'Order data must never travel unencrypted.',
    );
  }

  return { ...info, remote: true };
}

/** True when the URL is an approved target, without throwing — for diagnostics. */
export function isProjectDatabaseUrl(raw: string | undefined): boolean {
  try {
    assertProjectDatabase(raw);
    return true;
  } catch {
    return false;
  }
}
