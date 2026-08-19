import { query } from '@/lib/db/pool';
import { hashToken, mintToken } from './tokens';

/**
 * Single-use, expiring tokens for email verification and password reset.
 *
 * Only the digest is stored; the token itself exists in the emailed link and
 * nowhere else.
 */

export type TokenPurpose = 'verify_email' | 'reset_password';

/** A verification link is a convenience; a reset link is a credential. */
export const VERIFY_TTL_MINUTES = 24 * 60;
export const RESET_TTL_MINUTES = 60;

/**
 * Issue a token, invalidating any earlier unused one for the same purpose.
 *
 * Superseding matters for reset: if a user clicks "forgot password" three
 * times, only the newest link should work, otherwise an older link sitting in
 * an inbox stays live for its full hour.
 */
export async function issueToken(
  userId: number,
  purpose: TokenPurpose,
  ttlMinutes: number,
): Promise<string> {
  const token = mintToken();

  await query(
    `UPDATE user_tokens SET used_at = now()
      WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose],
  );

  await query(
    `INSERT INTO user_tokens (user_id, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [userId, purpose, hashToken(token), ttlMinutes],
  );

  return token;
}

/**
 * Spend a token, returning the user it belonged to, or null.
 *
 * The check and the marking are one statement, so two simultaneous clicks on
 * the same link cannot both succeed — the second `UPDATE` matches no row
 * because `used_at` is no longer null.
 */
export async function redeemToken(
  token: string,
  purpose: TokenPurpose,
): Promise<number | null> {
  if (!token) return null;

  const rows = await query<{ user_id: number }>(
    `UPDATE user_tokens
        SET used_at = now()
      WHERE token_hash = $1
        AND purpose = $2
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id`,
    [hashToken(token), purpose],
  );

  return rows[0]?.user_id ?? null;
}

/** Housekeeping only — expiry is enforced on redemption, not by this. */
export async function sweepExpiredTokens(): Promise<number> {
  const rows = await query<{ id: number }>(
    `DELETE FROM user_tokens
      WHERE expires_at <= now() - interval '7 days'
      RETURNING id`,
  );
  return rows.length;
}
