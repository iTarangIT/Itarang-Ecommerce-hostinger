import { queryOne } from '@/lib/db/pool';
import { hashPassword } from './password';
import { mintToken } from './tokens';
import { type AuthUser, type UserRole, createUser, normaliseEmail } from './users';

/**
 * The bridge from a Supabase Auth identity to a `users` row.
 *
 * Supabase proves who someone is; `users` is who they are to this shop — the
 * row every order, address and wishlist entry points at. This is the only code
 * that decides which row an identity becomes, and it is deliberately strict:
 *
 * 1. Already linked (`users.auth_user_id`) → that row, whatever its email now.
 * 2. Not linked, and Supabase has **confirmed** the address → the existing row
 *    with that email is claimed, provided no other identity holds it. This is
 *    how every account created before Supabase sign-in joins it.
 * 3. No row for the address → a customer is created, already linked.
 *
 * Anything else is null and the caller signs nobody in. In particular an
 * unconfirmed address never claims a row — otherwise typing someone's email
 * into a sign-up form would be a way into their account — and a row already
 * linked to a different identity is never re-pointed.
 *
 * Roles are never granted here. A new row is always a customer; an existing
 * row keeps the role it had. Whether a Supabase session may *act* as an admin
 * is decided per request in `session.ts`, not by this lookup.
 */

export interface SupabaseIdentity {
  /** `auth.users.id`. */
  id: string;
  email: string | null | undefined;
  /** Supabase's `email_confirmed_at`; null or absent means unproven. */
  emailConfirmedAt: string | null | undefined;
}

interface LinkedRow {
  id: number;
  email: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  email_verified_at: Date | null;
  must_change_password: boolean;
}

const RETURNING = `id, email, role, full_name, phone, email_verified_at, must_change_password`;

function toAuthUser(row: LinkedRow): AuthUser {
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

/** The row an identity is linked to, or null. Read-only; used on every request. */
export async function findLinkedUser(authUserId: string): Promise<AuthUser | null> {
  const row = await queryOne<LinkedRow>(
    `SELECT ${RETURNING} FROM users WHERE auth_user_id = $1`,
    [authUserId],
  );
  return row ? toAuthUser(row) : null;
}

/**
 * Resolve an identity to its account, linking or creating as described above.
 * Called once per sign-in, never per request.
 */
export async function linkSupabaseIdentity(identity: SupabaseIdentity): Promise<AuthUser | null> {
  const linked = await findLinkedUser(identity.id);
  if (linked) return linked;

  if (!identity.email || !identity.emailConfirmedAt) return null;
  const email = normaliseEmail(identity.email);

  // Claim an existing, unlinked row. Conditional on `auth_user_id IS NULL` in
  // the same statement, so two identities racing for one address cannot both
  // win, and an already-linked row is left alone.
  const claimed = await queryOne<LinkedRow>(
    `UPDATE users
        SET auth_user_id = $1,
            email_verified_at = COALESCE(email_verified_at, now())
      WHERE email = $2 AND auth_user_id IS NULL
      RETURNING ${RETURNING}`,
    [identity.id, email],
  );
  if (claimed) return toAuthUser(claimed);

  // The address has a row, but another identity holds it. Refuse.
  const taken = await queryOne<{ id: number }>(`SELECT id FROM users WHERE email = $1`, [email]);
  if (taken) return null;

  try {
    // The password hash is the same unusable sentinel the code sign-in has
    // always written: `password_hash` is NOT NULL, and a hash of a token that
    // is minted and dropped here verifies against nothing anyone holds.
    const created = await createUser({
      email,
      passwordHash: hashPassword(mintToken()),
      role: 'customer',
      emailVerified: true,
      authUserId: identity.id,
    });
    if (created) return created;
  } catch (error) {
    // A concurrent sign-in of the same identity inserted first and the unique
    // index on `auth_user_id` refused this one. Fall through and read it.
    if ((error as { code?: string }).code !== '23505') throw error;
  }

  // Lost a race on the email or the identity; whichever row won is the answer,
  // but only if it is this identity's.
  return findLinkedUser(identity.id);
}
