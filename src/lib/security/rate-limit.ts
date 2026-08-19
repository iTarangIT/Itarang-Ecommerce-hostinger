import { headers } from 'next/headers';
import { query } from '@/lib/db/pool';

/**
 * Fixed-window rate limiting, counted in PostgreSQL.
 *
 * One upsert per attempt returns the running count, so the check and the
 * increment are a single atomic statement — two simultaneous requests cannot
 * both read "9 of 10" and both proceed.
 *
 * **Fails open.** If the database is unreachable the limiter allows the
 * request rather than blocking it. That is the right trade here: these limits
 * protect against abuse, and a limiter outage must not become a site outage.
 * The endpoints that genuinely must not proceed without a database — order
 * placement — already fail closed on their own.
 */

export interface RateLimit {
  /** Attempts permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window ends — what a Retry-After should say. */
  resetSeconds: number;
}

/**
 * The limits, in one place so they can be read as a policy rather than found
 * scattered across route handlers.
 */
export const LIMITS = {
  /** Per email. Deliberately tight: this is the credential-guessing path. */
  login: { limit: 8, windowSeconds: 15 * 60 },
  /** Per IP, looser, so one address cannot spray many accounts. */
  loginByIp: { limit: 30, windowSeconds: 15 * 60 },
  /** Account creation, per IP. */
  register: { limit: 10, windowSeconds: 60 * 60 },
  /** Reset requests per email — each one sends mail, so this is anti-mail-bomb. */
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  /** Verification resends, per account. */
  verificationResend: { limit: 5, windowSeconds: 60 * 60 },
  /** Guest order lookup, per IP: order number + phone is brute-forceable. */
  orderLookup: { limit: 20, windowSeconds: 10 * 60 },
  /** Order placement, per account. Generous — a real shopper never hits it. */
  checkout: { limit: 20, windowSeconds: 10 * 60 },
  /** Payment mutations on an order the caller already owns. */
  paymentAction: { limit: 30, windowSeconds: 10 * 60 },
} as const satisfies Record<string, RateLimit>;

/**
 * Count an attempt against a bucket and say whether it may proceed.
 *
 * The bucket key is composed by the caller from a fixed prefix plus the
 * subject, so untrusted input can never be the whole key and cannot be crafted
 * to land in another bucket.
 */
export async function consume(bucket: string, config: RateLimit): Promise<RateLimitResult> {
  try {
    const rows = await query<{ count: number; reset_seconds: number }>(
      `WITH win AS (
         SELECT to_timestamp(
                  floor(extract(epoch FROM now()) / $2) * $2
                ) AS window_start
       )
       INSERT INTO rate_limits (bucket, window_start, count)
       SELECT $1, win.window_start, 1 FROM win
       ON CONFLICT (bucket, window_start)
         DO UPDATE SET count = rate_limits.count + 1
       RETURNING count,
                 ceil(extract(epoch FROM (window_start + ($2 || ' seconds')::interval - now())))::int
                   AS reset_seconds`,
      [bucket, config.windowSeconds],
    );

    const row = rows[0];
    if (!row) return { allowed: true, remaining: config.limit, resetSeconds: 0 };

    return {
      allowed: row.count <= config.limit,
      remaining: Math.max(0, config.limit - row.count),
      resetSeconds: Math.max(0, row.reset_seconds),
    };
  } catch (error) {
    // Fail open — see the note at the top of this file.
    console.error(`[rate-limit] check failed for ${bucket}: ${(error as Error).message}`);
    return { allowed: true, remaining: config.limit, resetSeconds: 0 };
  }
}

/**
 * The caller's IP, as far as it can be known.
 *
 * Behind Hostinger's proxy the socket address is the proxy, so the forwarded
 * chain is used. A client can forge `x-forwarded-for`, which means IP buckets
 * are a speed bump against unsophisticated abuse and nothing more — every
 * limit that actually matters is also keyed on something the caller cannot
 * choose freely, like the email being tried or the account placing an order.
 */
export async function callerIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || list.get('x-real-ip')?.trim() || 'unknown';
}

/** Remove windows nobody will read again. Housekeeping only. */
export async function sweepRateLimits(): Promise<number> {
  const rows = await query<{ bucket: string }>(
    `DELETE FROM rate_limits WHERE window_start < now() - interval '1 day' RETURNING bucket`,
  );
  return rows.length;
}
