import { cache } from 'react';
import { cookies } from 'next/headers';
import { query, queryOne } from '@/lib/db/pool';
import { type AuthUser, type UserRole } from './users';
import { hashToken, mintToken } from './tokens';

/**
 * Customer and admin sessions.
 *
 * Opaque token in the cookie, SHA-256 of it in the database. The database row
 * is authoritative for expiry, not the cookie's `maxAge` — a cookie's lifetime
 * is a hint the browser is free to ignore and an attacker is free to strip, so
 * the cookie is set to the absolute cap and the real sliding window is enforced
 * server-side on every read.
 *
 * That split also lets a session slide during an ordinary page render: renewing
 * only touches a database row, and Next.js does not permit writing a cookie
 * outside a Server Action or Route Handler.
 */

const COOKIE = 'itarang_session';

/** Sliding window: a session stays alive this long after it was last used. */
const IDLE_DAYS = 30;
/** Hard ceiling: no session outlives this, however actively it is used. */
const ABSOLUTE_DAYS = 90;
/** Don't write to the database on every request — renew at most this often. */
const RENEW_AFTER_MINUTES = 60;

const DAY_SECONDS = 24 * 60 * 60;

export interface SessionUser extends AuthUser {
  sessionId: number;
}

interface SessionRow {
  session_id: number;
  last_seen_at: Date;
  id: number;
  email: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  email_verified_at: Date | null;
  must_change_password: boolean;
}

/**
 * Start a session. Always mints a fresh token rather than reusing one, so a
 * token captured before sign-in cannot become an authenticated session
 * afterwards.
 */
export async function createSession(
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<void> {
  const token = mintToken();

  await query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, user_agent, ip)
     VALUES ($1, $2, now() + ($3 || ' days')::interval, $4, $5)`,
    [hashToken(token), userId, IDLE_DAYS, meta.userAgent ?? null, meta.ip ?? null],
  );

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_DAYS * DAY_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * The signed-in user, or null.
 *
 * Wrapped in React's `cache` so that a page which checks authentication in a
 * layout, a page and three components still performs one query per request.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<SessionRow>(
    `SELECT s.id AS session_id, s.last_seen_at,
            u.id, u.email, u.role, u.full_name, u.phone,
            u.email_verified_at, u.must_change_password
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.expires_at > now()
        AND s.created_at > now() - ($2 || ' days')::interval`,
    [hashToken(token), ABSOLUTE_DAYS],
  );

  if (!row) return null;

  // Slide the window, but never past the absolute ceiling.
  const staleFor = Date.now() - row.last_seen_at.getTime();
  if (staleFor > RENEW_AFTER_MINUTES * 60 * 1000) {
    await query(
      `UPDATE sessions
          SET last_seen_at = now(),
              expires_at = LEAST(
                now() + ($2 || ' days')::interval,
                created_at + ($3 || ' days')::interval
              )
        WHERE id = $1`,
      [row.session_id, IDLE_DAYS, ABSOLUTE_DAYS],
    );
  }

  return {
    sessionId: row.session_id,
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    emailVerifiedAt: row.email_verified_at,
    mustChangePassword: row.must_change_password,
  };
});

/** Sign out of this browser. Deletes the row, so the token dies immediately. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (token) {
    await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  }
  store.delete(COOKIE);
}

/** Sign out everywhere — used after a password reset. */
export async function destroyAllSessions(userId: number): Promise<void> {
  await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
}

/**
 * Remove expired rows. Nothing depends on this for correctness — every read
 * already filters on `expires_at` — it only stops the table growing forever.
 */
export async function sweepExpiredSessions(): Promise<number> {
  const rows = await query<{ id: number }>(
    `DELETE FROM sessions
      WHERE expires_at <= now()
         OR created_at <= now() - ($1 || ' days')::interval
      RETURNING id`,
    [ABSOLUTE_DAYS],
  );
  return rows.length;
}
