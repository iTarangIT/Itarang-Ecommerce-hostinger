import { cache } from 'react';
import { cookies } from 'next/headers';
import { query, queryOne } from '@/lib/db/pool';
import { type AuthUser, type UserRole } from './users';
import { hashToken, mintToken } from './tokens';
import { findLinkedUser } from './identity';
import { hasSupabaseCookie, supabaseAuth } from './supabase';

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
  /** The `sessions` row, for the original cookie; null for a Supabase session. */
  sessionId: number | null;
  /** Which sign-in produced this session. */
  authSource: 'session' | 'supabase';
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
 * Two kinds of session are honoured while sign-in moves to Supabase Auth: the
 * original `itarang_session` cookie, checked first so nobody signed in today
 * is signed out by the change, and a Supabase session linked to a `users` row.
 *
 * Wrapped in React's `cache` so that a page which checks authentication in a
 * layout, a page and three components still performs one lookup per request.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  return (await originalSessionUser()) ?? (await supabaseSessionUser());
});

async function originalSessionUser(): Promise<SessionUser | null> {
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
    authSource: 'session',
    id: row.id,
    email: row.email,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    emailVerifiedAt: row.email_verified_at,
    mustChangePassword: row.must_change_password,
  };
}

/**
 * A Supabase session, resolved to the `users` row it is linked to.
 *
 * `getClaims()` verifies the access token's signature (against the project's
 * keys, or by asking Supabase for a legacy-secret project) — the cookie alone
 * is never trusted. An identity with no linked row is not a signed-in user
 * here: linking happens once, at sign-in, in `identity.ts`.
 *
 * **An administrator needs a second factor.** A Supabase session for an admin
 * row counts as admin only at assurance level `aal2`, i.e. after an
 * authenticator-app code. Below that it is served as a customer. Admins sign
 * in with a password today; without this, proving the admin's email address
 * alone would be enough to open `/admin`, which would make the move to
 * Supabase a downgrade.
 */
async function supabaseSessionUser(): Promise<SessionUser | null> {
  const client = await supabaseAuth();
  if (!client) return null;

  // No auth cookie, no network call — the common case for a shopper.
  const store = await cookies();
  if (!hasSupabaseCookie(store.getAll().map((cookie) => cookie.name))) return null;

  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const user = await findLinkedUser(data.claims.sub);
  if (!user) return null;

  const role: UserRole = user.role === 'admin' && data.claims.aal !== 'aal2' ? 'customer' : user.role;

  return { ...user, role, sessionId: null, authSource: 'supabase' };
}

/**
 * Sign out of this browser: the original session row and cookie, and the
 * Supabase session if there is one. Deleting the row kills the token
 * immediately.
 */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;

  if (token) {
    await query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
  }
  store.delete(COOKIE);

  await signOutSupabase('local');
}

/**
 * End the Supabase session — this browser's (`local`) or every one this
 * identity holds (`global`). Clears the `sb-` cookies either way.
 *
 * A failure to reach Supabase must not keep someone signed in on this
 * browser: the library drops the local session before it reports the error,
 * so the error is ignored rather than surfaced.
 */
export async function signOutSupabase(scope: 'local' | 'global'): Promise<void> {
  const client = await supabaseAuth();
  if (!client) return;

  const store = await cookies();
  if (!hasSupabaseCookie(store.getAll().map((cookie) => cookie.name))) return;

  await client.auth.signOut({ scope });
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
