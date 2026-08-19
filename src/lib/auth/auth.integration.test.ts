import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { hashPassword, verifyPassword } from './password';
import { hashToken, mintToken } from './tokens';
import {
  MAX_FAILED_LOGINS,
  clearFailedLogins,
  createUser,
  findUserByEmail,
  isLockedOut,
  markEmailVerified,
  recordFailedLogin,
  setPassword,
} from './users';
import { RESET_TTL_MINUTES, issueToken, redeemToken } from './verification';

/**
 * Authentication against a live PostgreSQL.
 *
 * Same gating as the checkout suite: skipped without `DATABASE_URL`, and
 * skipped against a remote database unless `DB_ALLOW_REMOTE_TESTS=true`,
 * because these tests write real rows.
 *
 * Every row this suite creates hangs off a user with an `@integration.invalid`
 * address, and deleting that user cascades to sessions and tokens — so cleanup
 * is one statement and cannot miss anything.
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
  console.warn(
    REMOTE
      ? '\n  [skipped] Auth integration tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Auth integration tests need DATABASE_URL. See README → Database.\n',
  );
}

const DOMAIN = '@integration.invalid';
const EMAIL = `auth-suite${DOMAIN}`;
const PASSWORD = 'a perfectly ordinary passphrase';

describe.skipIf(!CONFIGURED)('authentication against the database', () => {
  beforeEach(async () => {
    // Cascades to sessions and user_tokens.
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await closePool();
  });

  it('creates an account and finds it by a differently-cased address', async () => {
    const user = await createUser({
      email: `  AUTH-SUITE${DOMAIN.toUpperCase()}  `,
      passwordHash: hashPassword(PASSWORD),
      fullName: 'Integration Person',
    });

    expect(user).not.toBeNull();
    expect(user!.email).toBe(EMAIL);
    expect(user!.role).toBe('customer');
    expect(user!.emailVerifiedAt).toBeNull();

    // Normalisation happens on read too, so the address is one account.
    expect(await findUserByEmail('Auth-Suite@Integration.Invalid')).not.toBeNull();
  });

  it('refuses a duplicate address without throwing', async () => {
    await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    // The unique index is the arbiter; a second insert returns null rather
    // than surfacing a 23505 to the caller.
    expect(await createUser({ email: EMAIL, passwordHash: hashPassword('other') })).toBeNull();
  });

  it('stores a verifiable hash and never the password', async () => {
    await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    const row = await findUserByEmail(EMAIL);

    expect(row!.password_hash).not.toContain(PASSWORD);
    expect(verifyPassword(PASSWORD, row!.password_hash)).toBe(true);
    expect(verifyPassword('the wrong one', row!.password_hash)).toBe(false);
  });

  it('locks an account after repeated failures and clears on success', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });

    for (let i = 0; i < MAX_FAILED_LOGINS; i += 1) {
      await recordFailedLogin(user!.id);
    }
    expect(isLockedOut((await findUserByEmail(EMAIL))!)).toBe(true);

    await clearFailedLogins(user!.id);
    const cleared = await findUserByEmail(EMAIL);
    expect(isLockedOut(cleared!)).toBe(false);
    expect(cleared!.failed_login_count).toBe(0);
  });

  it('marks an email verified exactly once', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });

    await markEmailVerified(user!.id);
    const first = await findUserByEmail(EMAIL);
    expect(first!.email_verified_at).not.toBeNull();

    // A second confirmation must not move the timestamp.
    await markEmailVerified(user!.id);
    expect((await findUserByEmail(EMAIL))!.email_verified_at!.getTime()).toBe(
      first!.email_verified_at!.getTime(),
    );
  });

  it('spends a reset token once and only once', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    const token = await issueToken(user!.id, 'reset_password', RESET_TTL_MINUTES);

    expect(await redeemToken(token, 'reset_password')).toBe(user!.id);
    // Replay is the attack this prevents.
    expect(await redeemToken(token, 'reset_password')).toBeNull();
  });

  it('will not redeem a token for the wrong purpose', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    const token = await issueToken(user!.id, 'verify_email', 60);

    expect(await redeemToken(token, 'reset_password')).toBeNull();
    expect(await redeemToken(token, 'verify_email')).toBe(user!.id);
  });

  it('supersedes an older unused reset token', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    const first = await issueToken(user!.id, 'reset_password', RESET_TTL_MINUTES);
    const second = await issueToken(user!.id, 'reset_password', RESET_TTL_MINUTES);

    // Only the newest link in the inbox may work.
    expect(await redeemToken(first, 'reset_password')).toBeNull();
    expect(await redeemToken(second, 'reset_password')).toBe(user!.id);
  });

  it('refuses an expired token', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    const token = await issueToken(user!.id, 'reset_password', RESET_TTL_MINUTES);

    await query(
      `UPDATE user_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = $1`,
      [user!.id],
    );
    expect(await redeemToken(token, 'reset_password')).toBeNull();
  });

  it('stores only the digest of a token, never the token', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    const token = await issueToken(user!.id, 'verify_email', 60);

    const rows = await query<{ token_hash: string }>(
      `SELECT token_hash FROM user_tokens WHERE user_id = $1 AND used_at IS NULL`,
      [user!.id],
    );
    expect(rows[0]!.token_hash).toBe(hashToken(token));
    expect(rows[0]!.token_hash).not.toContain(token);
  });

  it('changing a password revokes every existing session', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });

    // Two sessions, as if signed in on a laptop and a phone.
    for (const token of [mintToken(), mintToken()]) {
      await query(
        `INSERT INTO sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, now() + interval '30 days')`,
        [hashToken(token), user!.id],
      );
    }
    expect(
      (await query(`SELECT id FROM sessions WHERE user_id = $1`, [user!.id])).length,
    ).toBe(2);

    await setPassword(user!.id, hashPassword('a brand new passphrase'));

    // This is the point of the whole exercise: a password change must not
    // leave the compromised sessions it was meant to end still alive.
    expect(
      (await query(`SELECT id FROM sessions WHERE user_id = $1`, [user!.id])).length,
    ).toBe(0);

    const row = await findUserByEmail(EMAIL);
    expect(verifyPassword('a brand new passphrase', row!.password_hash)).toBe(true);
    expect(row!.must_change_password).toBe(false);
  });

  it('deleting a user takes their sessions and tokens with them', async () => {
    const user = await createUser({ email: EMAIL, passwordHash: hashPassword(PASSWORD) });
    await issueToken(user!.id, 'verify_email', 60);
    await query(
      `INSERT INTO sessions (token_hash, user_id, expires_at)
       VALUES ($1, $2, now() + interval '30 days')`,
      [hashToken(mintToken()), user!.id],
    );

    await query(`DELETE FROM users WHERE id = $1`, [user!.id]);

    expect((await query(`SELECT id FROM sessions WHERE user_id = $1`, [user!.id])).length).toBe(0);
    expect((await query(`SELECT id FROM user_tokens WHERE user_id = $1`, [user!.id])).length).toBe(
      0,
    );
  });
});
