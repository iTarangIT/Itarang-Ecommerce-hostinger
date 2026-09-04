import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { query, queryOne, transaction } from '@/lib/db/pool';

/**
 * One-time sign-in codes.
 *
 * Data access and cryptography only. No cookies, no redirects, no policy about
 * who may sign in — `otp-actions.ts` owns that. Kept separate so this file can
 * be unit-tested without `next/headers`.
 *
 * The threat this is built against is not a clever attack, it is an obvious
 * one: a six-digit code has a million possible values, which is small enough
 * to guess online if attempts are unbounded, and small enough to reverse
 * offline from a stolen digest if the digest is unkeyed. Both are closed here,
 * in the two places that can actually close them.
 */

/** Ten minutes. Long enough to switch to a mail app, short enough to matter. */
export const OTP_TTL_MINUTES = 10;

/** Guesses allowed against a single code before it is burned. */
export const OTP_MAX_ATTEMPTS = 5;

/** A resend before this many seconds have passed is refused. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export type OtpChannel = 'email' | 'sms';
export type OtpIdentifierKind = 'email' | 'phone';

export interface IssuedOtp {
  /** The plaintext code. Returned to the caller to send, then dropped. */
  code: string;
  expiresAt: Date;
}

export type OtpVerifyResult =
  | { ok: true; userId: number | null; identifier: string }
  /** No live code, or it expired, was spent, or was superseded. */
  | { ok: false; reason: 'no-code' }
  /** Wrong code. `remaining` is how many guesses are left after this one. */
  | { ok: false; reason: 'wrong-code'; remaining: number }
  /** The attempt cap was reached; the code is now dead. */
  | { ok: false; reason: 'too-many-attempts' };

/* ------------------------------------------------------------- the digest */

/**
 * The pepper, demanded at the point of use.
 *
 * Throws rather than falling back to an empty key. Hashing a six-digit secret
 * with `''` would produce a table that looks protected and is not, and the
 * failure would be invisible until the day it mattered — so it is loud now.
 */
function otpPepper(): string {
  const pepper = env().AUTH_OTP_PEPPER;
  if (!pepper) {
    throw new Error(
      'AUTH_OTP_PEPPER is not set. One-time sign-in codes cannot be issued or verified ' +
        'without it; refusing to hash codes with an empty key.',
    );
  }
  return pepper;
}

/**
 * `HMAC(pepper, salt : identifier : code)`.
 *
 * Three ingredients, each doing a job the others cannot:
 *
 * - **pepper** — held outside the database, so a stolen dump is not a stolen
 *   code. This is the one `hashToken`'s bare SHA-256 does not have, and the
 *   reason these codes do not live in `user_tokens`.
 * - **salt** — per row, so two people holding `123456` store different
 *   digests. That is why `code_hash` has no unique index, and why a dump
 *   cannot be grouped to find shared codes.
 * - **identifier** — binds the code to the address it was sent to, so a code
 *   mailed to one person cannot be replayed against another account.
 *
 * Deliberately HMAC and not scrypt. Verification is an unauthenticated
 * endpoint; a 100 ms key-derivation function there is a CPU amplifier that
 * anyone can pull on. The ten-minute lifetime, not the hash cost, is what
 * bounds an offline attack here.
 */
function digest(salt: string, identifier: string, code: string): string {
  return createHmac('sha256', otpPepper()).update(`${salt}:${identifier}:${code}`).digest('hex');
}

/** Constant-time compare, so the digest cannot be discovered a byte at a time. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Six digits, uniformly distributed.
 *
 * `randomInt` rather than `randomBytes(4) % 1_000_000`, which is biased: 2^32
 * is not a multiple of a million, so the low codes would come up slightly more
 * often. No filtering of "unlucky-looking" values such as `000000` either —
 * every excluded value is entropy given away for nothing.
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/* -------------------------------------------------------------- issuing */

/**
 * Mint a code for an identifier and store its digest.
 *
 * Supersedes any live code for the same identifier in the same transaction, so
 * a resend genuinely replaces rather than adds. Two live codes would double the
 * guessing surface and confuse the person holding two different emails.
 *
 * `userId` is null when no account exists yet. That is not an edge case, it is
 * the normal signup path: the challenge is issued before we admit whether the
 * address is registered, which is what stops the response revealing it.
 */
export async function issueOtp(input: {
  identifier: string;
  identifierKind: OtpIdentifierKind;
  channel: OtpChannel;
  userId: number | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<IssuedOtp> {
  const code = generateCode();
  const salt = randomBytes(16).toString('hex');
  const codeHash = digest(salt, input.identifier, code);

  const expiresAt = await transaction(async (client) => {
    await client.query(
      `UPDATE auth_otps
          SET invalidated_at = now()
        WHERE identifier = $1
          AND consumed_at IS NULL
          AND invalidated_at IS NULL`,
      [input.identifier],
    );

    const rows = await client.query<{ expires_at: Date }>(
      `INSERT INTO auth_otps
         (user_id, identifier, identifier_kind, channel, salt, code_hash,
          max_attempts, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7,
               now() + ($8 || ' minutes')::interval, $9, $10)
       RETURNING expires_at`,
      [
        input.userId,
        input.identifier,
        input.identifierKind,
        input.channel,
        salt,
        codeHash,
        OTP_MAX_ATTEMPTS,
        OTP_TTL_MINUTES,
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    );

    return rows.rows[0]!.expires_at;
  });

  return { code, expiresAt };
}

/**
 * Seconds until this identifier may request another code, or 0.
 *
 * A courtesy to the person waiting for mail that is still in flight, and a
 * brake on using our SMTP relay to flood someone's inbox. The per-identifier
 * rate limit is the real cap; this is what makes the common case civil.
 */
export async function secondsUntilResendAllowed(identifier: string): Promise<number> {
  const row = await queryOne<{ wait: number }>(
    `SELECT GREATEST(0, $2 - EXTRACT(EPOCH FROM (now() - created_at)))::int AS wait
       FROM auth_otps
      WHERE identifier = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [identifier, OTP_RESEND_COOLDOWN_SECONDS],
  );
  return row?.wait ?? 0;
}

/* ------------------------------------------------------------ verifying */

interface OtpRow {
  id: number;
  user_id: number | null;
  salt: string;
  code_hash: string;
  attempts: number;
  max_attempts: number;
}

/**
 * Check a code and, if it is right, spend it.
 *
 * Everything happens inside one transaction with the row locked, because all
 * three of the interesting failures are races:
 *
 * - two tabs submitting the same correct code must not both succeed, so the
 *   `consumed_at IS NULL` test and the write that sets it are the same
 *   statement against a locked row;
 * - parallel wrong guesses must each cost an attempt, so the counter is
 *   incremented under the lock rather than read-then-written;
 * - a code that reaches its cap is invalidated in the same breath, so the
 *   guess that hits the limit is also the last one that is possible.
 *
 * Only the newest live code for the identifier is considered. Older ones were
 * already superseded at issue time; this is belt and braces.
 */
export async function verifyOtp(identifier: string, code: string): Promise<OtpVerifyResult> {
  return transaction(async (client) => {
    const found = await client.query<OtpRow>(
      `SELECT id, user_id, salt, code_hash, attempts, max_attempts
         FROM auth_otps
        WHERE identifier = $1
          AND consumed_at IS NULL
          AND invalidated_at IS NULL
          AND expires_at > now()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [identifier],
    );

    const row = found.rows[0];
    if (!row) return { ok: false, reason: 'no-code' } as const;

    if (digestsMatch(row.code_hash, digest(row.salt, identifier, code))) {
      await client.query(`UPDATE auth_otps SET consumed_at = now() WHERE id = $1`, [row.id]);
      return { ok: true, userId: row.user_id, identifier } as const;
    }

    const attempts = row.attempts + 1;
    const exhausted = attempts >= row.max_attempts;

    await client.query(
      `UPDATE auth_otps
          SET attempts = $2,
              invalidated_at = CASE WHEN $3 THEN now() ELSE invalidated_at END
        WHERE id = $1`,
      [row.id, attempts, exhausted],
    );

    return exhausted
      ? ({ ok: false, reason: 'too-many-attempts' } as const)
      : ({ ok: false, reason: 'wrong-code', remaining: row.max_attempts - attempts } as const);
  });
}

/* ------------------------------------------------------------ housekeeping */

/**
 * Delete codes that can no longer be used.
 *
 * Spent and expired rows are of no use to us and of some use to anyone who
 * steals the table, so they do not accumulate. A day's grace so that "was a
 * code issued?" stays answerable while a support conversation is happening.
 */
export async function sweepExpiredOtps(): Promise<number> {
  const rows = await query<{ id: number }>(
    `DELETE FROM auth_otps
      WHERE expires_at < now() - interval '1 day'
         OR consumed_at < now() - interval '1 day'
      RETURNING id`,
  );
  return rows.length;
}
