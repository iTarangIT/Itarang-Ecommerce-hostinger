'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sendMail } from '@/lib/email/mailer';
import { resetPasswordMessage, verifyEmailMessage } from '@/lib/email/templates';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import { hashPassword, passwordProblem, verifyPassword } from './password';
import { safeNext } from './redirects';
import { createSession, currentUser, destroyAllSessions, destroySession } from './session';
import { linkVisitorToUser, visitorContext } from '@/lib/analytics/events';
import {
  RESET_TTL_MINUTES,
  VERIFY_TTL_MINUTES,
  issueToken,
  redeemToken,
} from './verification';
import {
  clearFailedLogins,
  findUserByEmail,
  isLockedOut,
  markEmailVerified,
  recordFailedLogin,
  setPassword,
} from './users';

/**
 * Authentication actions.
 *
 * Server Actions rather than route handlers, which gets Next.js's built-in
 * Origin↔Host check — a CSRF defence the `POST /api/*` handlers do not have.
 *
 * Two rules run through all of this:
 *
 * - **No account enumeration.** Sign-in, registration and password reset must
 *   not let an unauthenticated caller learn whether an address has an account.
 *   Sign-in gives one message for both causes; reset always claims success.
 * - **Redirect outside try/catch.** `redirect()` works by throwing, so calling
 *   it inside a `try` would have the `catch` swallow the navigation.
 */

export type AuthFormState = { error: string } | null;

const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.').max(200);

/*
 * `registerSchema` was here. It went with `registerAction`'s body — customers
 * are created by proving an emailed code, not by posting a chosen password.
 */

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

/**
 * A real scrypt hash of a value nobody knows.
 *
 * Verified against when the email does not exist, so a missing account costs
 * the same time as a wrong password. Without it, response latency answers
 * "is this address registered?" for anyone with a stopwatch.
 */
const DUMMY_HASH = hashPassword('this-hash-exists-only-to-equalise-timing');

/**
 * Only same-origin relative paths, so `?next=` cannot become an open redirect.
 *
 * Lives in `redirects.ts` rather than here because every export of a
 * `'use server'` module is a callable endpoint, and this rule is worth unit
 * tests. Moving it also closed two holes the two-line version had: it accepted
 * `/\evil.example` and `/<tab>/evil.example`, both of which several browsers
 * normalise into a scheme-relative URL pointing at another host.
 */

/** The message every throttled action returns. Never says which limit tripped. */
const THROTTLED: AuthFormState = {
  error: 'Too many attempts. Please wait a few minutes and try again.',
};

async function requestMeta() {
  const list = await headers();
  return {
    userAgent: list.get('user-agent'),
    // Behind Hostinger's proxy the socket address is the proxy, so prefer the
    // forwarded chain's first entry. Recorded for review only — never trusted
    // as an authentication factor, since a client can set it freely.
    ip: list.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  };
}

/* ----------------------------------------------------------- register */

/**
 * Retired. Customers sign up by proving a one-time code.
 *
 * The refusal is here, in the action, rather than only in the page that used
 * to render its form. Every export of a `'use server'` module is a callable
 * endpoint: removing the form removes the button, not the door. A caller who
 * posts to this directly gets the same answer as one who cannot find it.
 *
 * Why it cannot simply keep working alongside OTP: it calls `createUser`
 * without a role, so it only ever mints `role = 'customer'`
 * (`users.ts` — `input.role ?? 'customer'`), and a customer created here could
 * not then sign in, because `loginAction` refuses customers by password. It
 * would manufacture accounts that are locked out on arrival.
 *
 * Administrators are unaffected — they are created by `scripts/admin-create.mts`,
 * which does not go through here.
 *
 * The signature is kept so existing `useActionState` callers still typecheck.
 * The body is gone rather than left unreachable behind an early return: dead
 * code that still reads like a working signup is the kind of thing someone
 * revives by deleting one line.
 *
 * Still rate limited. An endpoint that refuses cheaply is still an endpoint,
 * and the `register:ip:` bucket is one of the markers `security.test.ts`
 * checks for, so the guarantee that every auth action counts against a limit
 * stays literally true.
 */
export async function registerAction(
  _prev: AuthFormState,
  _formData: FormData,
): Promise<AuthFormState> {
  const rate = await consume(`register:ip:${await callerIp()}`, LIMITS.register);
  if (!rate.allowed) return THROTTLED;

  return {
    error:
      'Accounts are created by signing in with an email code. ' +
      'Enter your email address on the sign-in page and we will send you one.',
  };
}


/**
 * Attach the browsing that led here to the account that just authenticated.
 *
 * Additive and resolved at query time — prior `funnel_events` keep the
 * `user_id` they had when they happened. Rewriting them would misreport what
 * was actually known at the time, and would have to be redone on every new
 * device the same person signs in from.
 */
async function linkBrowsingHistory(userId: number): Promise<void> {
  // `visitorContext`, not `peekVisitor`.
  //
  // `peekVisitor` needs both cookies and returns null when either is missing.
  // `itarang_vsid` lapses after 30 minutes; `itarang_vid` lives for 180 days —
  // so someone who browsed last week and signs in today has a visitor id and no
  // session, and the peek discarded both. That silently dropped the single most
  // valuable link there is: anonymous browsing to the account it turned into.
  //
  // A Server Action may write cookies, so mint the missing half instead. When
  // the visitor is genuinely new this links an empty history, which is harmless
  // and additive — and it seats the cookie so everything after this is linked.
  const visitor = await visitorContext();
  await linkVisitorToUser(visitor.visitorId, userId);
}

/* -------------------------------------------------------------- login */

export async function loginAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  // One message for every failure below, so nothing distinguishes "no such
  // account" from "wrong password".
  const REJECT: AuthFormState = { error: 'Those details do not match an account.' };
  if (!parsed.success) return REJECT;

  // Two buckets, and both matter. Per email stops one account being ground
  // down; per IP stops one attacker spraying a common password across many
  // accounts, which the per-email limit would never notice. Counted before the
  // password is checked, so each attempt costs an attacker a slot whether or
  // not the address exists — and before scrypt runs, so guessing cannot be
  // used to burn CPU.
  const [byEmail, byIp] = await Promise.all([
    consume(`login:${parsed.data.email}`, LIMITS.login),
    consume(`login:ip:${await callerIp()}`, LIMITS.loginByIp),
  ]);
  if (!byEmail.allowed || !byIp.allowed) return THROTTLED;

  const row = await findUserByEmail(parsed.data.email);

  if (!row) {
    verifyPassword(parsed.data.password, DUMMY_HASH);
    return REJECT;
  }

  if (isLockedOut(row)) {
    return {
      error: 'Too many failed attempts. Try again in a few minutes, or reset your password.',
    };
  }

  if (!verifyPassword(parsed.data.password, row.password_hash)) {
    await recordFailedLogin(row.id);
    return REJECT;
  }

  /**
   * Customers authenticate with a one-time code, never with a password.
   *
   * This is the authentication boundary for that rule, and it is deliberately
   * here rather than in the page that draws the form. A form is a rendering
   * decision: hiding the password fields would leave the action reachable by
   * anyone willing to post to it, which is not a policy, it is a suggestion.
   *
   * Existing customer rows still carry a `password_hash` — they are
   * development accounts and nothing was migrated — and accounts created by
   * the OTP flow carry an unusable sentinel. Neither is a way in, because this
   * check runs before a session is ever created.
   *
   * **Placed after `verifyPassword`, on purpose.** A check before it would
   * answer for a customer address without paying scrypt's cost, so the
   * response time would tell an unauthenticated caller which addresses are
   * administrators — an oracle this function otherwise works hard not to be.
   * `REJECT` is the same object a wrong password returns, so the two are
   * indistinguishable in both content and timing.
   *
   * The failed-attempt counter is incremented for the same reason: not because
   * the password was wrong, but so that this branch costs exactly what that
   * one costs and leaves the same trace.
   */
  if (row.role !== 'admin') {
    await recordFailedLogin(row.id);
    return REJECT;
  }

  await clearFailedLogins(row.id);
  await createSession(row.id, await requestMeta());
  await linkBrowsingHistory(row.id);

  redirect(safeNext(formData.get('next')) ?? (row.role === 'admin' ? '/admin' : '/account'));
}

/* ------------------------------------------------------------- logout */

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/');
}

/**
 * Sign out of every browser this account is signed in on.
 *
 * The answer to "I signed in on a friend's laptop" and to "I think somebody
 * else has been in my account" — neither of which the ordinary sign-out helps
 * with, because it only deletes the session row for the cookie in hand.
 *
 * Takes no arguments, like `resendVerificationAction` and for the same reason:
 * every export of a `'use server'` module is a callable endpoint, so a
 * `signOutEverywhere(userId)` signature would let anyone post any id and
 * have this server revoke a stranger's sessions. The identity comes from the
 * session, which the caller cannot choose.
 */
export async function logoutEverywhereAction(): Promise<void> {
  const user = await currentUser();
  if (user) await destroyAllSessions(user.id);
  // Drops the cookie as well. Without it the browser keeps sending a token
  // whose row is gone — harmless, since every read joins against `sessions`,
  // but it leaves a signed-out browser carrying a credential for no reason.
  await destroySession();
  redirect('/login?signedout=all');
}

/* ------------------------------------------------------ password reset */

export async function requestResetAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = emailSchema.safeParse(formData.get('email'));

  // Whatever happens below, the caller is told the same thing. An address that
  // has no account and an address that does must be indistinguishable.
  if (parsed.success) {
    // Each successful request sends mail, so an unlimited endpoint is a
    // mail-bombing amplifier pointed at somebody else's inbox.
    const rate = await consume(`reset:${parsed.data}`, LIMITS.passwordReset);

    const row = rate.allowed ? await findUserByEmail(parsed.data) : null;

    /**
     * Only an administrator has a password worth resetting.
     *
     * A customer who completed a reset would still be refused by `loginAction`,
     * so the mail would send them round a loop that cannot end in a sign-in —
     * and it would do it in a message that implies otherwise. Their route back
     * into the account is the code at `/login`, which needs nothing recovered.
     *
     * This leaks nothing: the redirect below is unconditional, so the response
     * is identical for an admin, a customer, an unknown address and a
     * throttled request alike.
     */
    if (row && row.role === 'admin') {
      const token = await issueToken(row.id, 'reset_password', RESET_TTL_MINUTES);
      await sendMail(resetPasswordMessage(row.email, token));
    }
  }

  redirect('/forgot-password?sent=1');
}

export async function resetPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (password !== confirm) return { error: 'Both passwords must match.' };

  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  const userId = await redeemToken(token, 'reset_password');
  if (!userId) {
    return { error: 'That reset link has expired or has already been used. Request a new one.' };
  }

  // Sets the password and drops every session for this user in one
  // transaction, then belt-and-braces in case one was created in between.
  await setPassword(userId, hashPassword(password));
  await destroyAllSessions(userId);

  redirect('/login?reset=1');
}

/* ---------------------------------------------------- change password */

/**
 * Change the password of the signed-in user.
 *
 * The current password is required even though there is already a session:
 * it is what stops someone who walks up to an unlocked browser from taking the
 * account permanently. Succeeding drops every session, this one included, so
 * the user signs in again with the new password.
 */
export async function changePasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (next !== confirm) return { error: 'Both new passwords must match.' };

  const problem = passwordProblem(next);
  if (problem) return { error: problem };

  // The current-password field is a password-guessing surface too, for anyone
  // who reaches an unlocked browser.
  const rate = await consume(`change-password:user:${user.id}`, LIMITS.login);
  if (!rate.allowed) return THROTTLED;

  const row = await findUserByEmail(user.email);
  if (!row || !verifyPassword(current, row.password_hash)) {
    return { error: 'Your current password is not correct.' };
  }

  if (verifyPassword(next, row.password_hash)) {
    return { error: 'Choose a password you have not used here before.' };
  }

  await setPassword(row.id, hashPassword(next));

  redirect('/login?reset=1');
}

/* -------------------------------------------------- email verification */

/**
 * Redeem a verification token. Returns whether it worked, rather than
 * redirecting, so the page can render an outcome.
 */
export async function verifyEmailAction(token: string): Promise<boolean> {
  const userId = await redeemToken(token, 'verify_email');
  if (!userId) return false;
  await markEmailVerified(userId);
  return true;
}

/**
 * Send a fresh verification link to the signed-in user.
 *
 * Takes no arguments on purpose. Every export of a `'use server'` module is a
 * callable endpoint, so a `resend(userId, email)` signature would let anyone
 * post arbitrary ids and addresses and have this server mail them. The identity
 * comes from the session, which the caller cannot choose.
 */
export async function resendVerificationAction(): Promise<AuthFormState> {
  const user = await currentUser();
  if (!user) return { error: 'Sign in first.' };
  if (user.emailVerifiedAt) return null;

  const rate = await consume(`verify-resend:user:${user.id}`, LIMITS.verificationResend);
  if (!rate.allowed) return THROTTLED;

  const token = await issueToken(user.id, 'verify_email', VERIFY_TTL_MINUTES);
  await sendMail(verifyEmailMessage(user.email, token));
  return null;
}
