import { readFileSync } from 'node:fs';
import type { ConnectionOptions } from 'node:tls';
import { type InspectedDatabaseUrl, assertProjectDatabase } from './guard.ts';

/**
 * The single place that decides how a connection is opened.
 *
 * Both entry points use it — the application pool (`pool.ts`) and the migration
 * CLI (`scripts/db.mts`) — so the two cannot drift into disagreeing about TLS,
 * which is exactly the kind of difference that shows up only in production.
 *
 * Server-only. Nothing here may be imported from a client component.
 */

export interface DatabaseConnection {
  info: InspectedDatabaseUrl;
  connectionString: string;
  /** `undefined` for local — a loopback connection needs no TLS. */
  ssl: ConnectionOptions | undefined;
}

/**
 * Remove `sslmode` from the connection string.
 *
 * `pg` merges the parsed connection string *over* the explicit client config,
 * so a `sslmode` in the URL silently wins against the `ssl` object below and
 * our TLS policy would never be applied. `pg` also currently reads `require`
 * as `verify-full` and has announced that this will change in v9 — one more
 * reason not to let the URL decide.
 *
 * The guard still demands `sslmode=require` in `DATABASE_URL`: it is the
 * operator's explicit statement of intent, and it is what `psql` and every
 * other libpq client will read. It is stripped only on the way into `pg`,
 * where `ssl` below is authoritative.
 *
 * Only the query string is touched — the credentials are never re-encoded.
 */
function withoutSslMode(raw: string): string {
  const q = raw.indexOf('?');
  if (q === -1) return raw;

  const base = raw.slice(0, q);
  const kept = raw
    .slice(q + 1)
    .split('&')
    .filter((pair) => !/^sslmode=/i.test(pair));

  return kept.length > 0 ? `${base}?${kept.join('&')}` : base;
}

/**
 * TLS settings for the approved remote target.
 *
 * Supabase issues pooler certificates from its own private root ("Supabase
 * Root 2021 CA"), which is not in Node's default trust store, so verification
 * needs that certificate: download it from the dashboard under Project
 * Settings → Database → SSL Configuration and point `DB_SSL_CA_FILE` at it.
 *
 * Without it the chain cannot be verified. `DB_SSL_INSECURE=true` then falls
 * back to an encrypted-but-unauthenticated connection — traffic is private,
 * but nothing proves the far end is really the database. It is deliberately
 * an opt-in with an ugly name, and deliberately logged every time.
 */
function sslFor(info: InspectedDatabaseUrl): ConnectionOptions | undefined {
  if (!info.remote) return undefined;

  const caFile = process.env.DB_SSL_CA_FILE;
  if (caFile) {
    return { ca: readFileSync(caFile, 'utf8'), rejectUnauthorized: true };
  }

  if (process.env.DB_SSL_INSECURE === 'true') {
    console.warn(
      '[db] DB_SSL_INSECURE=true — the connection is encrypted but the server ' +
        'certificate is NOT verified. Set DB_SSL_CA_FILE to the provider CA instead.',
    );
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

/**
 * Guarded connection settings. Throws `DatabaseGuardError` before returning if
 * `DATABASE_URL` is not an approved target, so no caller can open a connection
 * without having passed the guard.
 */
export function connectionOptions(): DatabaseConnection {
  const info = assertProjectDatabase(process.env.DATABASE_URL);

  return {
    info,
    connectionString: withoutSslMode(process.env.DATABASE_URL as string),
    ssl: sslFor(info),
  };
}
