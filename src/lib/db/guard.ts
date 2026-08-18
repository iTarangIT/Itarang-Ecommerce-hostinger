/**
 * Database safety guard.
 *
 * This project is a LOCAL TESTING environment. It owns exactly one database —
 * `itarang_dev` on this machine — and must never touch anything else.
 *
 * `tarang_dev` belongs to a different application and differs from our database
 * name by a single leading character, which is precisely the kind of typo a
 * host-only check would wave through. It is therefore named in an explicit
 * denylist as well as being excluded by the exact-name rule.
 *
 * Every database entry point — the connection pool and all `db:*` scripts —
 * calls `assertLocalDatabase()` **before opening a connection**, so a
 * misconfigured URL aborts before a single statement is issued.
 *
 * Loosening any of this must be a deliberate, reviewable edit to this file.
 */

/** The only database this project may connect to. */
export const EXPECTED_DATABASE = 'itarang_dev';

/** Hosts considered local. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Databases known to belong to other applications on this machine.
 * Named explicitly so the failure message is unambiguous.
 */
const FORBIDDEN_DATABASES = new Set(['tarang_dev', 'postgres', 'template0', 'template1']);

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
  /** Safe to log — credentials removed. */
  redacted: string;
}

/**
 * Parse a connection string without ever exposing the password.
 * Throws `DatabaseGuardError` on anything unparseable.
 */
export function inspectDatabaseUrl(raw: string): InspectedDatabaseUrl {
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

/**
 * Refuse to proceed unless the URL points at this project's own local database.
 * Returns the inspected URL so callers can log it safely.
 */
export function assertLocalDatabase(raw: string | undefined): InspectedDatabaseUrl {
  if (!raw) {
    throw new DatabaseGuardError(
      'DATABASE_URL is not set. Copy .env.example to .env.local and point it at ' +
        `a local ${EXPECTED_DATABASE} database.`,
    );
  }

  const info = inspectDatabaseUrl(raw);

  // 1. Local only.
  if (!LOCAL_HOSTS.has(info.host)) {
    throw new DatabaseGuardError(
      `Refusing to connect: this build writes to a local database only, but ` +
        `DATABASE_URL points at host "${info.host}". No remote database may be used.`,
    );
  }

  // 2. Explicitly forbidden names, checked before the equality rule so the
  //    message names the actual problem.
  if (FORBIDDEN_DATABASES.has(info.database)) {
    throw new DatabaseGuardError(
      `Refusing to connect: database "${info.database}" belongs to another ` +
        `application (or is a system database). This project may only use ` +
        `"${EXPECTED_DATABASE}".`,
    );
  }

  // 3. Exact match on the database this project owns.
  if (info.database !== EXPECTED_DATABASE) {
    throw new DatabaseGuardError(
      `Refusing to connect: expected database "${EXPECTED_DATABASE}" but ` +
        `DATABASE_URL names "${info.database}".`,
    );
  }

  return info;
}

/** True when the URL is safe, without throwing — for diagnostics surfaces. */
export function isLocalDatabaseUrl(raw: string | undefined): boolean {
  try {
    assertLocalDatabase(raw);
    return true;
  } catch {
    return false;
  }
}
