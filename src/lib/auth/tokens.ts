import { createHash, randomBytes } from 'node:crypto';

/**
 * Opaque token primitives, shared by sessions and emailed links.
 *
 * The rule both use: the token is generated once, handed to exactly one place
 * (a cookie, or a link in an email), and only its SHA-256 digest is written to
 * the database. Anyone who reads the `sessions` or `user_tokens` table — a
 * backup, a log, a leaked dump — gets digests, which cannot be replayed.
 *
 * SHA-256 without a salt or work factor is the right choice here, unlike for
 * passwords: these are 256-bit random values, so there is no dictionary to run
 * against them and nothing for a slow hash to buy.
 */

/** 32 random bytes, URL-safe — usable in a cookie and in a link unescaped. */
export function mintToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
