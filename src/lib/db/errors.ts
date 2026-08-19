import { DatabaseGuardError } from './guard';

/**
 * Distinguish "the database is not available" from a genuine application bug.
 *
 * Failing closed is correct — an order must never be accepted that we could not
 * record — but the failure should say so plainly rather than surfacing a bare
 * 500 with an empty body.
 */

const CONNECTION_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  // Remote database. `ENETUNREACH` in particular is what an IPv6-only host
  // looks like from a network without IPv6 — a configuration problem that
  // must not surface as an application bug.
  'ENETUNREACH',
  'ECONNRESET',
  'EAI_AGAIN',
  '08001', // client cannot establish connection
  '08006', // connection failure
  '28P01', // invalid password
  '3D000', // database does not exist
  '53300', // too many connections
  '57P03', // cannot connect now
]);

export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof DatabaseGuardError) return true;
  const candidate = error as { code?: string; message?: string };
  if (candidate?.code && CONNECTION_CODES.has(candidate.code)) return true;
  return /DATABASE_URL|ECONNREFUSED|does not exist|password authentication/i.test(
    candidate?.message ?? '',
  );
}

/** A message safe to return to the caller — never contains a credential. */
export function databaseUnavailableMessage(error: unknown): string {
  if (error instanceof DatabaseGuardError) return error.message;
  return (
    'The order database is not available, so this order was not created and nothing was ' +
    'charged. Check that DATABASE_URL is reachable — see README → Database.'
  );
}
