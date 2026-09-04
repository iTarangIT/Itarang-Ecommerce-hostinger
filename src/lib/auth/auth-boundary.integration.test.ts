import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closePool, query, queryOne } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';

/**
 * Who may authenticate, and how — asserted through the actions themselves.
 *
 * This is the test that Stage 2A exists to satisfy. The rule is a mutual
 * exclusion on `users.role`:
 *
 *   admin     → password yes, one-time code no
 *   customer  → password no,  one-time code yes
 *
 * Asserting it anywhere other than the real server actions would prove the
 * rule is written down, not that anything consults it. So `loginAction`,
 * `registerAction`, `requestResetAction` and `verifyLoginCodeAction` are all
 * driven for real, against real rows, with only the framework's request-scoped
 * plumbing replaced.
 *
 * Three modules are mocked and only three: `next/headers` (no request here),
 * `next/navigation` (`redirect` works by throwing, which is how success is
 * detected below) and the analytics linker (it wants a cookie jar). Every
 * decision under test — rate limits, scrypt verification, lockout, the role
 * gate, session creation — is the real code path against the real database.
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
    '\n  [skipped] Auth boundary tests need DATABASE_URL, AUTH_OTP_PEPPER, and ' +
      'DB_ALLOW_REMOTE_TESTS=true against a remote database.\n',
  );
}

const DB_TIMEOUT = 30_000;

/* ------------------------------------------------------------------ mocks */

/** Thrown in place of a real navigation, so a redirect is observable. */
class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

const cookieJar = new Map<string, string>();

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

vi.mock('next/headers', () => ({
  headers: async () => new Map<string, string>(),
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

vi.mock('@/lib/analytics/events', () => ({
  visitorContext: async () => ({ visitorId: 'test-visitor', sessionId: 'test-session' }),
  linkVisitorToUser: async () => undefined,
}));

const { loginAction, registerAction, requestResetAction } = await import('./actions');
const { verifyLoginCodeAction } = await import('./otp-actions');
const { hashPassword } = await import('./password');
const { createUser } = await import('./users');
const { issueOtp } = await import('./otp');

/* --------------------------------------------------------------- fixtures */

const DOMAIN = '@boundary.invalid';
const ADMIN = `admin-fixture${DOMAIN}`;
const CUSTOMER = `customer-fixture${DOMAIN}`;
const PASSWORD = 'a perfectly ordinary passphrase';

/**
 * Fixture accounts, created and destroyed by this suite.
 *
 * The real administrator account is never read, never written and never
 * authenticated against. It is the only real account in the system, so a test
 * that touched it would be a test that could lock somebody out of the console.
 */
async function seedUsers() {
  const admin = await createUser({
    email: ADMIN,
    passwordHash: hashPassword(PASSWORD),
    role: 'admin',
    emailVerified: true,
  });
  const customer = await createUser({
    email: CUSTOMER,
    passwordHash: hashPassword(PASSWORD),
    role: 'customer',
    emailVerified: true,
  });
  return { admin: admin!, customer: customer! };
}

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
};

/** Runs an action, turning the redirect-throw back into a value. */
async function run(
  action: (prev: never, data: FormData) => Promise<unknown>,
  data: FormData,
): Promise<{ redirectedTo?: string; state?: { error?: string } }> {
  try {
    const state = (await action(undefined as never, data)) as { error?: string } | null;
    return { state: state ?? undefined };
  } catch (error) {
    if (error instanceof RedirectSignal) return { redirectedTo: error.to };
    throw error;
  }
}

const sessionCount = async (userId: number) =>
  Number(
    (
      await queryOne<{ n: string }>(`SELECT count(*) AS n FROM sessions WHERE user_id = $1`, [
        userId,
      ])
    )?.n ?? 0,
  );

describe.skipIf(!CONFIGURED)('the customer / admin authentication boundary', () => {
  beforeEach(async () => {
    cookieJar.clear();
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM auth_otps WHERE identifier LIKE $1`, [`%${DOMAIN}`]);
    // The limiter is shared state; a previous test's attempts would otherwise
    // throttle the next one and mask the behaviour under test.
    await query(`DELETE FROM rate_limits WHERE bucket LIKE $1`, [`%${DOMAIN}%`]);
  });

  afterEach(async () => {
    await query(`DELETE FROM rate_limits WHERE bucket LIKE $1`, [`%${DOMAIN}%`]);
  });

  afterAll(async () => {
    await query(`DELETE FROM users WHERE email LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM auth_otps WHERE identifier LIKE $1`, [`%${DOMAIN}`]);
    await query(`DELETE FROM rate_limits WHERE bucket LIKE $1`, [`%${DOMAIN}%`]);
    await closePool();
  });

  /* ------------------------------------------------- passwords: admins only */

  it(
    'signs an administrator in with a password, exactly as before',
    async () => {
      const { admin } = await seedUsers();

      const result = await run(loginAction, form({ email: ADMIN, password: PASSWORD }));

      expect(result.redirectedTo).toBe('/admin');
      expect(await sessionCount(admin.id)).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses a customer holding the CORRECT password',
    async () => {
      const { customer } = await seedUsers();

      const result = await run(loginAction, form({ email: CUSTOMER, password: PASSWORD }));

      // The password is right. The account is not entitled to use it.
      expect(result.redirectedTo).toBeUndefined();
      expect(result.state?.error).toBeTruthy();
      // The part that matters: no session was created.
      expect(await sessionCount(customer.id)).toBe(0);
    },
    DB_TIMEOUT,
  );

  it(
    'gives a customer the same answer as a wrong password, so it is no oracle',
    async () => {
      await seedUsers();

      const rejected = await run(loginAction, form({ email: CUSTOMER, password: PASSWORD }));
      const wrong = await run(
        loginAction,
        form({ email: ADMIN, password: 'definitely not the password' }),
      );
      const unknown = await run(
        loginAction,
        form({ email: `nobody${DOMAIN}`, password: PASSWORD }),
      );

      // Identical text for "you may not", "wrong password" and "no account".
      // Anything else would let a stranger sort addresses into staff and not.
      expect(rejected.state?.error).toBe(wrong.state?.error);
      expect(rejected.state?.error).toBe(unknown.state?.error);
    },
    DB_TIMEOUT,
  );

  /* ---------------------------------------------------- codes: customers only */

  it(
    'signs a customer in with a one-time code',
    async () => {
      const { customer } = await seedUsers();
      const { code } = await issueOtp({
        identifier: CUSTOMER,
        identifierKind: 'email',
        channel: 'email',
        userId: customer.id,
      });

      const result = await run(verifyLoginCodeAction, form({ email: CUSTOMER, code }));

      expect(result.redirectedTo).toBe('/account');
      expect(await sessionCount(customer.id)).toBe(1);
    },
    DB_TIMEOUT,
  );

  it(
    'refuses an administrator holding a VALID code',
    async () => {
      const { admin } = await seedUsers();
      const { code } = await issueOtp({
        identifier: ADMIN,
        identifierKind: 'email',
        channel: 'email',
        userId: admin.id,
      });

      const result = await run(verifyLoginCodeAction, form({ email: ADMIN, code }));

      // A mailbox alone must not reach /admin. A password plus a mailbox is two
      // things to steal; an emailed code is one.
      expect(result.redirectedTo).toBeUndefined();
      expect(result.state?.error).toMatch(/password/i);
      expect(await sessionCount(admin.id)).toBe(0);
    },
    DB_TIMEOUT,
  );

  it(
    'creates the account on a first successful code',
    async () => {
      const fresh = `newcomer${DOMAIN}`;
      const { code } = await issueOtp({
        identifier: fresh,
        identifierKind: 'email',
        channel: 'email',
        userId: null,
      });

      const result = await run(verifyLoginCodeAction, form({ email: fresh, code }));
      expect(result.redirectedTo).toBe('/account');

      const created = await queryOne<{
        id: number;
        role: string;
        password_hash: string;
        email_verified_at: Date | null;
      }>(`SELECT id, role, password_hash, email_verified_at FROM users WHERE email = $1`, [fresh]);

      expect(created).not.toBeNull();
      expect(created!.role).toBe('customer');
      // Verified by construction: they proved control of the mailbox.
      expect(created!.email_verified_at).not.toBeNull();
      // The sentinel. NOT NULL is satisfied without the column being relaxed.
      expect(created!.password_hash).toMatch(/^scrypt\./);
    },
    DB_TIMEOUT,
  );

  it(
    'gives the new account a password that authenticates nobody',
    async () => {
      const fresh = `sentinel${DOMAIN}`;
      const { code } = await issueOtp({
        identifier: fresh,
        identifierKind: 'email',
        channel: 'email',
        userId: null,
      });
      await run(verifyLoginCodeAction, form({ email: fresh, code }));

      // Refused twice over: it is a customer, and nobody holds the discarded
      // token that hash was made from.
      const attempt = await run(loginAction, form({ email: fresh, password: PASSWORD }));
      expect(attempt.redirectedTo).toBeUndefined();
      expect(attempt.state?.error).toBeTruthy();
    },
    DB_TIMEOUT,
  );

  it(
    'clears the password-lockout counters on a successful code',
    async () => {
      const { customer } = await seedUsers();
      await query(
        `UPDATE users SET failed_login_count = 8, locked_until = now() + interval '15 minutes'
          WHERE id = $1`,
        [customer.id],
      );

      const { code } = await issueOtp({
        identifier: CUSTOMER,
        identifierKind: 'email',
        channel: 'email',
        userId: customer.id,
      });

      // Lockout is a brake on password guessing. Honouring it here would let
      // anyone spray wrong passwords at an address to deny that customer the
      // one sign-in method that actually works for them.
      const result = await run(verifyLoginCodeAction, form({ email: CUSTOMER, code }));
      expect(result.redirectedTo).toBe('/account');

      const after = await queryOne<{ failed_login_count: number; locked_until: Date | null }>(
        `SELECT failed_login_count, locked_until FROM users WHERE id = $1`,
        [customer.id],
      );
      expect(after!.failed_login_count).toBe(0);
      expect(after!.locked_until).toBeNull();
    },
    DB_TIMEOUT,
  );

  /* ------------------------------------------------------- retired surfaces */

  it(
    'refuses password registration even when called directly',
    async () => {
      // Removing the form removes the button, not the endpoint: every export of
      // a 'use server' module is callable.
      const result = await run(
        registerAction,
        form({ email: `signup${DOMAIN}`, password: PASSWORD, fullName: 'Someone New' }),
      );

      expect(result.redirectedTo).toBeUndefined();
      expect(result.state?.error).toMatch(/email code/i);
      expect(
        await queryOne(`SELECT id FROM users WHERE email = $1`, [`signup${DOMAIN}`]),
      ).toBeNull();
    },
    DB_TIMEOUT,
  );

  it(
    'issues a password-reset token for an admin and not for a customer',
    async () => {
      const { admin, customer } = await seedUsers();

      const adminAsk = await run(requestResetAction, form({ email: ADMIN }));
      const customerAsk = await run(requestResetAction, form({ email: CUSTOMER }));

      // Same visible answer for both — the redirect is unconditional, so the
      // page cannot be used to tell staff addresses from customer ones.
      expect(adminAsk.redirectedTo).toBe('/forgot-password?sent=1');
      expect(customerAsk.redirectedTo).toBe('/forgot-password?sent=1');

      const tokens = async (userId: number) =>
        Number(
          (
            await queryOne<{ n: string }>(
              `SELECT count(*) AS n FROM user_tokens WHERE user_id = $1 AND purpose = 'reset_password'`,
              [userId],
            )
          )?.n ?? 0,
        );

      expect(await tokens(admin.id)).toBe(1);
      // A customer completing a reset would still be refused at sign-in, so the
      // mail would promise a route that does not exist.
      expect(await tokens(customer.id)).toBe(0);
    },
    DB_TIMEOUT,
  );
});
