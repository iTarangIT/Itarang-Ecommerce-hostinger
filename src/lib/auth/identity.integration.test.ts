import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query, queryOne } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { findLinkedUser, linkSupabaseIdentity } from './identity';
import { hashPassword } from './password';
import { createUser } from './users';

/**
 * Linking Supabase identities to accounts, against a live PostgreSQL.
 *
 * Gated like the other database suites. The `auth` schema is not needed: the
 * link is a column on `users`, and the foreign key to `auth.users` only exists
 * on Supabase (migration 0019), so identity ids here are bare UUIDs.
 */

function targetsRemote(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn('\n  [skipped] Identity linking tests need a local DATABASE_URL.\n');
}

const DOMAIN = '@identity.invalid';
const CONFIRMED = '2026-10-15T00:00:00Z';

function identity(email: string, confirmed: string | null = CONFIRMED) {
  return { id: randomUUID(), email, emailConfirmedAt: confirmed };
}

async function authUserIdOf(email: string): Promise<string | null> {
  const row = await queryOne<{ auth_user_id: string | null }>(
    `SELECT auth_user_id FROM users WHERE email = $1`,
    [email],
  );
  return row?.auth_user_id ?? null;
}

describe.skipIf(!CONFIGURED)('linking a Supabase identity to an account', () => {
  beforeEach(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await closePool();
  });

  it('creates a customer, already linked, for a confirmed address with no account', async () => {
    const who = identity(`new${DOMAIN}`);

    const user = await linkSupabaseIdentity(who);

    expect(user).not.toBeNull();
    expect(user!.email).toBe(`new${DOMAIN}`);
    expect(user!.role).toBe('customer');
    expect(user!.emailVerifiedAt).not.toBeNull();
    expect(await authUserIdOf(`new${DOMAIN}`)).toBe(who.id);
  });

  it('claims the existing account for the address, keeping its id and role', async () => {
    const existing = await createUser({
      email: `existing${DOMAIN}`,
      passwordHash: hashPassword('a perfectly ordinary passphrase'),
      role: 'admin',
    });
    const who = identity(`  EXISTING${DOMAIN.toUpperCase()} `);

    const user = await linkSupabaseIdentity(who);

    expect(user!.id).toBe(existing!.id);
    expect(user!.role).toBe('admin');
    expect(user!.emailVerifiedAt).not.toBeNull();
    expect(await authUserIdOf(`existing${DOMAIN}`)).toBe(who.id);
  });

  it('refuses an unconfirmed address, and claims and creates nothing', async () => {
    await createUser({ email: `victim${DOMAIN}`, passwordHash: hashPassword('x'.repeat(12)) });

    expect(await linkSupabaseIdentity(identity(`victim${DOMAIN}`, null))).toBeNull();
    expect(await linkSupabaseIdentity(identity(`nobody${DOMAIN}`, null))).toBeNull();

    expect(await authUserIdOf(`victim${DOMAIN}`)).toBeNull();
    const created = await queryOne(`SELECT id FROM users WHERE email = $1`, [`nobody${DOMAIN}`]);
    expect(created).toBeNull();
  });

  it('never re-points an account another identity already holds', async () => {
    const first = identity(`held${DOMAIN}`);
    const second = identity(`held${DOMAIN}`);

    expect(await linkSupabaseIdentity(first)).not.toBeNull();
    expect(await linkSupabaseIdentity(second)).toBeNull();

    expect(await authUserIdOf(`held${DOMAIN}`)).toBe(first.id);
  });

  it('returns the same account on every later sign-in, even after an email change', async () => {
    const who = identity(`stable${DOMAIN}`);
    const first = await linkSupabaseIdentity(who);

    const again = await linkSupabaseIdentity({ ...who, email: `renamed${DOMAIN}` });

    expect(again!.id).toBe(first!.id);
    expect(await findLinkedUser(who.id)).toMatchObject({ id: first!.id });
    const count = await queryOne<{ n: number }>(
      `SELECT count(*)::int AS n FROM users WHERE email LIKE $1`,
      [`%${DOMAIN}`],
    );
    expect(count!.n).toBe(1);
  });

  it('settles two simultaneous first sign-ins of one identity on one account', async () => {
    const who = identity(`race${DOMAIN}`);

    const [a, b] = await Promise.all([linkSupabaseIdentity(who), linkSupabaseIdentity(who)]);

    expect(a!.id).toBe(b!.id);
    expect(await authUserIdOf(`race${DOMAIN}`)).toBe(who.id);
  });
});
