'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import { query } from '@/lib/db/pool';
import { mintToken } from './tokens';
import { hashPassword } from './password';
import { safeNext } from './redirects';
import { createSession } from './session';
import { linkVisitorToUser, visitorContext } from '@/lib/analytics/events';
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  issueOtp,
  secondsUntilResendAllowed,
  verifyOtp,
} from './otp';
import { OtpDeliveryError, transportFor } from './otp-transport';
import { createUser, findUserByEmail, markEmailVerified, normaliseEmail } from './users';

/**
 * Customer sign-in by one-time code.
 *
 * Deliberately a separate module from `actions.ts`. That file is the password
 * path, which is now administrators only, and keeping the two apart means the
 * customer flow can grow without anybody editing the sign-in that the one real
 * administrator account depends on.
 *
 * Signup and login are the same flow, and that is a security property rather
 * than a shortcut. A code is issued for an address whether or not it has an
 * account; the account is created when the code comes back proved. Because the
 * response is identical either way, there is no request an unauthenticated
 * caller can make that distinguishes "registered" from "not registered" — the
 * thing `loginAction` works hard to hide is here simply not knowable.
 *
 * The same two rules as `actions.ts` apply: no enumeration, and `redirect()`
 * outside any try/catch, because it works by throwing.
 */

export type OtpFormState =
  | { step: 'identifier'; error?: string }
  | { step: 'code'; identifier: string; error?: string; notice?: string }
  | null;

const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address.')
  .max(200);

const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code from your email.');

const THROTTLED = 'Too many attempts. Please wait a few minutes and try again.';

/**
 * One message for every delivery failure.
 *
 * Says the code was not sent, which is true and actionable, and does not say
 * why. The cause is an SMTP credential, a relay refusal or a bad recipient
 * domain — none of which is the visitor's business, and one of which would
 * confirm whether an address exists upstream.
 */
const UNDELIVERABLE =
  'We could not send a sign-in code just now. Please try again in a few minutes, ' +
  'or contact support if it keeps happening.';

async function requestMeta() {
  const list = await headers();
  return {
    userAgent: list.get('user-agent'),
    ip: list.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  };
}

/* --------------------------------------------------------- request a code */

export async function requestLoginCodeAction(
  _prev: OtpFormState,
  formData: FormData,
): Promise<OtpFormState> {
  const parsed = identifierSchema.safeParse(formData.get('email'));
  if (!parsed.success) {
    return { step: 'identifier', error: parsed.error.issues[0]!.message };
  }

  const identifier = normaliseEmail(parsed.data);

  const [byIdentifier, byIp] = await Promise.all([
    consume(`otp-request:${identifier}`, LIMITS.otpRequest),
    consume(`otp-request:ip:${await callerIp()}`, LIMITS.otpRequestByIp),
  ]);
  if (!byIdentifier.allowed || !byIp.allowed) {
    return { step: 'identifier', error: THROTTLED };
  }

  // A resend that arrives before the previous mail has plausibly landed is
  // answered without issuing anything. Advancing to the code step regardless
  // keeps the response shape identical and lets the visitor type the code they
  // already have.
  const wait = await secondsUntilResendAllowed(identifier);
  if (wait > 0) {
    return {
      step: 'code',
      identifier,
      notice: `We have already sent a code. You can ask for another in ${wait} seconds.`,
    };
  }

  // Looked up so the code can be tied to the account when there is one. The
  // answer never reaches the caller: both branches issue, send and respond
  // identically.
  const existing = await findUserByEmail(identifier);
  const meta = await requestMeta();

  const { code } = await issueOtp({
    identifier,
    identifierKind: 'email',
    channel: 'email',
    userId: existing?.id ?? null,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  try {
    await transportFor('email').send(identifier, code);
  } catch (error) {
    // The one place this flow reports a failure rather than claiming success.
    // A code that was never delivered must not look like a code in flight, or
    // the visitor waits for mail that is not coming and we have told them a
    // lie. Invalidate it so nothing is left live that nobody can use.
    await query(
      `UPDATE auth_otps
          SET invalidated_at = now()
        WHERE identifier = $1 AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [identifier],
    );

    if (!(error instanceof OtpDeliveryError)) {
      console.error(`[otp] unexpected delivery failure: ${(error as Error).message}`);
    }
    return { step: 'identifier', error: UNDELIVERABLE };
  }

  return {
    step: 'code',
    identifier,
    notice: `We sent a 6-digit code to ${identifier}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  };
}

/* ---------------------------------------------------------- verify a code */

export async function verifyLoginCodeAction(
  _prev: OtpFormState,
  formData: FormData,
): Promise<OtpFormState> {
  const identifierResult = identifierSchema.safeParse(formData.get('email'));
  if (!identifierResult.success) {
    return { step: 'identifier', error: 'Start again with your email address.' };
  }
  const identifier = normaliseEmail(identifierResult.data);

  const codeResult = codeSchema.safeParse(formData.get('code'));
  if (!codeResult.success) {
    return { step: 'code', identifier, error: codeResult.error.issues[0]!.message };
  }

  const limited = await consume(`otp-verify:${identifier}`, LIMITS.otpVerify);
  if (!limited.allowed) return { step: 'code', identifier, error: THROTTLED };

  const result = await verifyOtp(identifier, codeResult.data);

  if (!result.ok) {
    if (result.reason === 'no-code') {
      return {
        step: 'code',
        identifier,
        error: 'That code has expired or was already used. Ask for a new one.',
      };
    }
    if (result.reason === 'too-many-attempts') {
      return {
        step: 'code',
        identifier,
        error: `That code is no longer valid after ${OTP_MAX_ATTEMPTS} incorrect attempts. Ask for a new one.`,
      };
    }
    return {
      step: 'code',
      identifier,
      error:
        result.remaining === 1
          ? 'That code is not right. One more attempt before it expires.'
          : `That code is not right. ${result.remaining} attempts left.`,
    };
  }

  // From here the caller has proved control of the mailbox.

  const existing = await findUserByEmail(identifier);

  if (existing) {
    /**
     * Administrators sign in with a password, not a code.
     *
     * Refused here rather than at the request step on purpose. Refusing
     * earlier would answer "is this address an administrator?" for anyone who
     * can type it into a form. Refusing here means the question is only
     * answered to somebody who has already read the mailbox — at which point
     * they have a great deal more than a role name.
     *
     * A mailbox alone should not reach `/admin`. A password plus a mailbox is
     * two things to steal; an emailed code is one.
     */
    if (existing.role === 'admin') {
      return {
        step: 'code',
        identifier,
        error: 'This address signs in with a password. Use the staff sign-in page.',
      };
    }

    /**
     * A successful code clears the password-lockout counters.
     *
     * The OTP path never consults `locked_until`, and that is deliberate.
     * Lockout is a brake on password guessing; honouring it here would let
     * anyone spray wrong passwords at an address to deny that customer the
     * sign-in method that actually works. Guessing is bounded instead by the
     * per-code attempt cap, which is tighter.
     */
    await query(
      `UPDATE users
          SET failed_login_count = 0,
              locked_until = NULL,
              email_verified_at = COALESCE(email_verified_at, now())
        WHERE id = $1`,
      [existing.id],
    );

    await startSession(existing.id);
  } else {
    /**
     * First sign-in creates the account.
     *
     * The password hash is a *sentinel*: a scrypt hash of a freshly minted
     * 32-byte token that is generated, hashed and dropped on the next line.
     * `users.password_hash` is NOT NULL and stays that way — relaxing it would
     * change the type `loginAction` reads, and that is the administrator path.
     * Nobody holds a value that verifies against a discarded random token, and
     * the role gate in `actions.ts` refuses customers by password regardless,
     * so this authenticates no one twice over.
     */
    const created = await createUser({
      email: identifier,
      passwordHash: hashPassword(mintToken()),
      role: 'customer',
      emailVerified: true,
    });

    // Null means the unique index caught a simultaneous first sign-in from two
    // tabs. The other one won and the account exists, so read it back rather
    // than failing the person who is holding a valid code.
    const user = created ?? (await findUserByEmail(identifier));
    if (!user) return { step: 'code', identifier, error: 'Something went wrong. Try again.' };

    if (!created) await markEmailVerified(user.id);
    await startSession(user.id);
  }

  redirect(safeNext(formData.get('next')) ?? '/account');
}

/**
 * Seat the session and attach the anonymous browsing that preceded it.
 *
 * `createSession` always mints a fresh token, so a token captured before
 * sign-in cannot become an authenticated one — session fixation is handled
 * there and inherited here.
 */
async function startSession(userId: number): Promise<void> {
  await createSession(userId, await requestMeta());

  // Mirrors `linkBrowsingHistory` in `actions.ts`: a Server Action may write
  // cookies, so the missing half of the visitor pair is minted rather than the
  // link being dropped.
  const visitor = await visitorContext();
  await linkVisitorToUser(visitor.visitorId, userId);
}
