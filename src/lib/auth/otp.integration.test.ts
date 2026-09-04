import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query, queryOne } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { hashPassword } from './password';
import { createUser } from './users';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  issueOtp,
  secondsUntilResendAllowed,
  sweepExpiredOtps,
  verifyOtp,
} from './otp';

/**
 * One-time codes against a live PostgreSQL.
 *
 * Same gating as the other DB suites: skipped without `DATABASE_URL`, and
 * skipped against a remote database unless `DB_ALLOW_REMOTE_TESTS=true`.
 *
 * Everything here is about a transaction doing what it claims — single use,
 * the attempt cap, supersede-on-resend — so none of it can be demonstrated
 * against a mock. Rows are addressed by an `@otp.invalid` identifier and
 * deleted by prefix, so this suite cannot touch a real account or a real code.
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
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.AUTH_OTP_PEPPER) &&
  (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn(
    !process.env.AUTH_OTP_PEPPER
      ? '\n  [skipped] OTP integration tests need AUTH_OTP_PEPPER.\n'
      : REMOTE
        ? '\n  [skipped] OTP integration tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
        : '\n  [skipped] OTP integration tests need DATABASE_URL. See README → Database.\n',
  );
}

/** The remote pooler is slow enough that vitest's 5s default is the flake. */
const DB_TIMEOUT = 30_000;

const DOMAIN = '@otp.invalid';
const IDENTIFIER = `otp-suite${DOMAIN}`;

const issueFor = (identifier = IDENTIFIER, userId: number | null = null) =>
  issueOtp({ identifier, identifierKind: 'email', channel: 'email', userId });

const rowFor = (identifier = IDENTIFIER) =>
  queryOne<{
    id: string;
    attempts: number;
    consumed_at: Date | null;
    invalidated_at: Date | null;
    code_hash: string;
    salt: string;
  }>(
    `SELECT id, attempts, consumed_at, invalidated_at, code_hash, salt
       FROM auth_otps WHERE identifier = $1 ORDER BY created_at DESC LIMIT 1`,
    [identifier],
  );

/** A code that is definitely not the one issued. */
const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');

describe.skipIf(!CONFIGURED)('one-time sign-in codes', () => {
  beforeEach(async () => {
    await query(`DELETE FROM auth_otps WHERE identifier LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
  });

  afterAll(async () => {
    await query(`DELETE FROM auth_otps WHERE identifier LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await closePool();
  });

  /* ------------------------------------------------------------- issuing */

  it(
    'stores a digest and never the code itself',
    async () => {
      const { code } = await issueFor();
      const row = await rowFor();

      expect(row).not.toBeNull();
      // The whole point of the table: someone reading it cannot sign in.
      expect(row!.code_hash).not.toContain(code);
      expect(row!.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(row!.salt).toMatch(/^[0-9a-f]{32}$/);
    },
    DB_TIMEOUT,
  );

  it(
    'gives two identical codes different digests',
    async () => {
      // The per-row salt in action. Without it, a stolen table could be sorted
      // to find everyone currently holding the same code — and one cracked
      // digest would unlock all of them.
      const a = await issueFor(`salt-a${DOMAIN}`);
      const b = await issueFor(`salt-b${DOMAIN}`);

      const rowA = await rowFor(`salt-a${DOMAIN}`);
      const rowB = await rowFor(`salt-b${DOMAIN}`);

      expect(rowA!.salt).not.toBe(rowB!.salt);
      // Even in the rare case the same six digits were drawn twice.
      if (a.code === b.code) expect(rowA!.code_hash).not.toBe(rowB!.code_hash);
    },
    DB_TIMEOUT,
  );

  it(
    'issues for an address with no account, so signup and login are one flow',
    async () => {
      // `user_id` is nullable precisely for this: the code is issued before we
      // admit whether the address is registered, which is what stops the
      // response answering that question.
      const { code } = await issueFor();
      const result = await verifyOtp(IDENTIFIER, code);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.userId).toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    'ties the code to an existing account when there is one',
    async () => {
      const user = await createUser({
        email: IDENTIFIER,
        passwordHash: hashPassword('irrelevant to this test'),
      });

      const { code } = await issueFor(IDENTIFIER, user!.id);
      const result = await verifyOtp(IDENTIFIER, code);

      expect(result.ok).toBe(true);
      if (result.ok) expect(result.userId).toBe(user!.id);
    },
    DB_TIMEOUT,
  );

  /* ----------------------------------------------------------- verifying */

  it(
    'accepts the right code exactly once',
    async () => {
      const { code } = await issueFor();

      expect((await verifyOtp(IDENTIFIER, code)).ok).toBe(true);

      // Replay. The `consumed_at` test and the write that sets it are the same
      // locked statement, so a second submission cannot win.
      const replay = await verifyOtp(IDENTIFIER, code);
      expect(replay.ok).toBe(false);
      if (!replay.ok) expect(replay.reason).toBe('no-code');
    },
    DB_TIMEOUT,
  );

  it(
    'rejects a wrong code and counts the attempt',
    async () => {
      const { code } = await issueFor();
      const result = await verifyOtp(IDENTIFIER, wrongCodeFor(code));

      expect(result.ok).toBe(false);
      if (!result.ok && result.reason === 'wrong-code') {
        expect(result.remaining).toBe(OTP_MAX_ATTEMPTS - 1);
      }
      expect((await rowFor())!.attempts).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'burns the code at the attempt cap, so guessing is bounded by the row',
    async () => {
      const { code } = await issueFor();
      const wrong = wrongCodeFor(code);

      for (let i = 1; i < OTP_MAX_ATTEMPTS; i += 1) {
        const attempt = await verifyOtp(IDENTIFIER, wrong);
        expect(attempt.ok, `attempt ${i} should have been rejected`).toBe(false);
      }

      const last = await verifyOtp(IDENTIFIER, wrong);
      expect(last.ok).toBe(false);
      if (!last.ok) expect(last.reason).toBe('too-many-attempts');

      // Dead, and the correct code no longer works either — which is the point.
      // Otherwise five guesses would cost an attacker nothing.
      expect((await rowFor())!.invalidated_at).not.toBeNull();
      const afterBurn = await verifyOtp(IDENTIFIER, code);
      expect(afterBurn.ok).toBe(false);
    },
    DB_TIMEOUT,
  );

  it(
    'is bounded by the row, not by the rate limiter which fails open',
    async () => {
      // The cap lives in `auth_otps.attempts` for exactly this reason: a
      // database error makes `consume()` allow the request, so if the limiter
      // were the only brake, a limiter outage would be an open door.
      const { code } = await issueFor();
      const row = await rowFor();
      expect(row!.attempts).toBe(0);

      await verifyOtp(IDENTIFIER, wrongCodeFor(code));
      expect((await rowFor())!.attempts).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses an expired code',
    async () => {
      const { code } = await issueFor();
      await query(`UPDATE auth_otps SET expires_at = now() - interval '1 second'
                    WHERE identifier = $1`, [IDENTIFIER]);

      const result = await verifyOtp(IDENTIFIER, code);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe('no-code');
    },
    DB_TIMEOUT,
  );

  it(
    'will not accept a code issued for a different address',
    async () => {
      // The identifier is mixed into the digest, so a code read out of one
      // mailbox cannot be replayed against another account.
      const { code } = await issueFor(`victim${DOMAIN}`);
      await issueFor(`attacker${DOMAIN}`);

      const result = await verifyOtp(`attacker${DOMAIN}`, code);
      expect(result.ok).toBe(false);
    },
    DB_TIMEOUT,
  );

  /* ------------------------------------------------------------ resending */

  it(
    'supersedes the previous code when a new one is issued',
    async () => {
      const first = await issueFor();
      const second = await issueFor();

      // Two live codes would double the guessing surface and leave the person
      // holding two emails wondering which is current.
      const stale = await verifyOtp(IDENTIFIER, first.code);
      expect(stale.ok).toBe(false);

      expect((await verifyOtp(IDENTIFIER, second.code)).ok).toBe(true);
    },
    DB_TIMEOUT,
  );

  it(
    'reports how long until another code may be requested',
    async () => {
      await issueFor();
      const wait = await secondsUntilResendAllowed(IDENTIFIER);

      expect(wait).toBeGreaterThan(0);
      expect(wait).toBeLessThanOrEqual(OTP_RESEND_COOLDOWN_SECONDS);
    },
    DB_TIMEOUT,
  );

  it(
    'allows a request when nothing has been sent yet',
    async () => {
      expect(await secondsUntilResendAllowed(`fresh${DOMAIN}`)).toBe(0);
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------------- housekeeping */

  it(
    'sweeps codes that are long dead and keeps live ones',
    async () => {
      await issueFor(`live${DOMAIN}`);
      await issueFor(`stale${DOMAIN}`);
      await query(
        `UPDATE auth_otps SET expires_at = now() - interval '2 days' WHERE identifier = $1`,
        [`stale${DOMAIN}`],
      );

      await sweepExpiredOtps();

      expect(await rowFor(`stale${DOMAIN}`)).toBeNull();
      expect(await rowFor(`live${DOMAIN}`)).not.toBeNull();
    },
    DB_TIMEOUT,
  );
});
