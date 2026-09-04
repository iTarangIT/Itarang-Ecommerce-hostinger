import { query, queryOne, transaction } from '@/lib/db/pool';

/**
 * User records.
 *
 * Data access only — no policy decisions, no cookie handling. Kept separate
 * from `session.ts` so the bootstrap CLI can create an admin without pulling in
 * `next/headers`.
 */

export type UserRole = 'customer' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  emailVerifiedAt: Date | null;
  mustChangePassword: boolean;
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  email_verified_at: Date | null;
  must_change_password: boolean;
  failed_login_count: number;
  locked_until: Date | null;
}

const COLUMNS = `
  id, email, password_hash, role, full_name, phone,
  email_verified_at, must_change_password, failed_login_count, locked_until
`;

function toUser(row: UserRow): AuthUser {
  return {
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
 * One address is one account, so every read and write goes through the same
 * normalisation. Doing this in one place is what makes the unique index on
 * `users.email` mean what it looks like it means.
 */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = $1`, [
    normaliseEmail(email),
  ]);
}

export async function findUserById(id: number): Promise<AuthUser | null> {
  const row = await queryOne<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = $1`, [id]);
  return row ? toUser(row) : null;
}

export { toUser };

export interface NewUser {
  email: string;
  passwordHash: string;
  fullName?: string;
  phone?: string;
  role?: UserRole;
  mustChangePassword?: boolean;
  emailVerified?: boolean;
}

/**
 * Create an account. Returns null when the address is already taken — the
 * unique index is the arbiter, not a preceding SELECT, so two simultaneous
 * registrations cannot both succeed.
 */
export async function createUser(input: NewUser): Promise<AuthUser | null> {
  const rows = await query<UserRow>(
    `INSERT INTO users (email, password_hash, full_name, phone, role,
                        must_change_password, email_verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${COLUMNS}`,
    [
      normaliseEmail(input.email),
      input.passwordHash,
      input.fullName ?? null,
      input.phone ?? null,
      input.role ?? 'customer',
      input.mustChangePassword ?? false,
      input.emailVerified ? new Date() : null,
    ],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

/* ------------------------------------------------------- lockout state */

/** Lockout thresholds. Deliberately generous — this stops scripts, not people. */
export const MAX_FAILED_LOGINS = 8;
export const LOCKOUT_MINUTES = 15;

export function isLockedOut(row: Pick<UserRow, 'locked_until'>): boolean {
  return row.locked_until !== null && row.locked_until.getTime() > Date.now();
}

/**
 * Count a failed attempt and lock the account once the threshold is crossed.
 * The counter keeps climbing while locked, so a script that keeps hammering
 * simply keeps extending its own lockout.
 */
export async function recordFailedLogin(userId: number): Promise<void> {
  await query(
    `UPDATE users
        SET failed_login_count = failed_login_count + 1,
            locked_until = CASE
              WHEN failed_login_count + 1 >= $2
              THEN now() + ($3 || ' minutes')::interval
              ELSE locked_until
            END
      WHERE id = $1`,
    [userId, MAX_FAILED_LOGINS, LOCKOUT_MINUTES],
  );
}

export async function clearFailedLogins(userId: number): Promise<void> {
  await query(
    `UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1`,
    [userId],
  );
}

/* ------------------------------------------------------------ mutation */

/** Raised when the phone a customer entered already belongs to another account. */
export class PhoneInUseError extends Error {
  constructor() {
    super('That mobile number is already on another account.');
    this.name = 'PhoneInUseError';
  }
}

/**
 * Update the profile fields a customer owns.
 *
 * Email is not among them: it is the sign-in identifier, so changing it is
 * changing a credential and needs the new address proved before the old one
 * stops working.
 *
 * `phone` carries a partial unique index (migration 0014), which is what makes
 * it usable as an identifier later. A collision therefore surfaces as a
 * constraint violation rather than a silent overwrite, and is translated here
 * so callers do not have to know PostgreSQL error codes.
 */
export async function updateProfile(
  userId: number,
  input: { fullName: string; phone: string | null },
): Promise<AuthUser | null> {
  try {
    const row = await queryOne<UserRow>(
      `UPDATE users SET full_name = $2, phone = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
      [userId, input.fullName.trim(), input.phone?.trim() || null],
    );
    return row ? toUser(row) : null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    const constraint = String((error as { constraint?: string }).constraint ?? '');
    if (code === '23505' && constraint.includes('phone')) throw new PhoneInUseError();
    throw error;
  }
}

export async function markEmailVerified(userId: number): Promise<void> {
  await query(
    `UPDATE users SET email_verified_at = now() WHERE id = $1 AND email_verified_at IS NULL`,
    [userId],
  );
}

/**
 * Change a password and revoke every existing session for that user, in one
 * transaction.
 *
 * The revocation is the point: a password change usually means "someone else
 * may have had access". Leaving old sessions alive would make the change
 * cosmetic for exactly the case it exists to handle.
 */
export async function setPassword(userId: number, passwordHash: string): Promise<void> {
  await transaction(async (client) => {
    await client.query(
      `UPDATE users
          SET password_hash = $2, must_change_password = false,
              failed_login_count = 0, locked_until = NULL
        WHERE id = $1`,
      [userId, passwordHash],
    );
    await client.query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  });
}
