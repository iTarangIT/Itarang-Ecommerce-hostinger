'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sendMail } from '@/lib/email/mailer';
import {
  accountExistsMessage,
  resetPasswordMessage,
  verifyEmailMessage,
} from '@/lib/email/templates';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import { hashPassword, passwordProblem, verifyPassword } from './password';
import { createSession, currentUser, destroyAllSessions, destroySession } from './session';
import { linkVisitorToUser, peekVisitor } from '@/lib/analytics/events';
import {
  RESET_TTL_MINUTES,
  VERIFY_TTL_MINUTES,
  issueToken,
  redeemToken,
} from './verification';
import {
  clearFailedLogins,
  createUser,
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

const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Choose a password.'),
  fullName: z.string().trim().min(2, 'Enter your name.').max(120),
});

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

/** Only same-origin relative paths, so `?next=` cannot become an open redirect. */
function safeNext(raw: FormDataEntryValue | null): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

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

export async function registerAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the details and try again.' };
  }

  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem };

  // Per IP: account creation is the one action with no prior identity to key
  // on, and unlimited signups are how a mailer gets abused as an open relay.
  const rate = await consume(`register:ip:${await callerIp()}`, LIMITS.register);
  if (!rate.allowed) return THROTTLED;

  const user = await createUser({
    email: parsed.data.email,
    passwordHash: hashPassword(parsed.data.password),
    fullName: parsed.data.fullName,
  });

  // `createUser` returns null when the address is taken. Saying so would
  // confirm the account exists, so the response is the same either way: we
  // send mail to the address and show the neutral "check your inbox" screen.
  if (!user) {
    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      const token = await issueToken(existing.id, 'reset_password', RESET_TTL_MINUTES);
      await sendMail(accountExistsMessage(existing.email, token));
    }
    redirect('/login?registered=1');
  }

  const token = await issueToken(user.id, 'verify_email', VERIFY_TTL_MINUTES);
  await sendMail(verifyEmailMessage(user.email, token));

  await createSession(user.id, await requestMeta());
  await linkBrowsingHistory(user.id);

  redirect(safeNext(formData.get('next')) ?? '/account?welcome=1');
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
  const visitor = await peekVisitor();
  if (visitor) await linkVisitorToUser(visitor.visitorId, userId);
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
    if (row) {
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
