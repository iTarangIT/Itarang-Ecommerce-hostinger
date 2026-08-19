import { NextResponse } from 'next/server';
import { type SessionUser, currentUser } from '@/lib/auth/session';
import { LIMITS, type RateLimit, consume } from '@/lib/security/rate-limit';
import { crossOriginRejection } from '@/lib/security/origin';
import { hasOrderAccess } from './access';
import { normaliseOrderNumber } from './numbering';
import { orders } from './postgres-repository';
import type { Order } from './types';

/**
 * The authentication gate on order placement.
 *
 * Shared by `/api/checkout/order` and `/api/checkout/cod` so the two cannot
 * drift — one route quietly losing this check would be a silent hole, and both
 * write the same rows.
 *
 * A route handler answers 401 rather than redirecting: these endpoints are
 * called by `fetch` from the checkout form, and an HTML sign-in page is a
 * useless reply to that. The client turns the 401 into a redirect itself,
 * keeping the cart — which lives in localStorage — untouched.
 */

export const UNAUTHENTICATED = {
  error: 'Sign in to place an order.',
  code: 'authentication_required',
} as const;

export const RATE_LIMITED = {
  error: 'Too many requests. Please wait a moment and try again.',
  code: 'rate_limited',
} as const;

function tooManyRequests(resetSeconds: number): NextResponse {
  return NextResponse.json(RATE_LIMITED, {
    status: 429,
    // Tells a well-behaved client when to come back instead of hammering.
    headers: { 'Retry-After': String(Math.max(1, resetSeconds)) },
  });
}

/**
 * The gate every state-changing checkout endpoint passes through:
 * same-origin, then authenticated, then within its rate limit.
 *
 * Ordered deliberately. The origin check is free and rejects forged
 * cross-site requests before any database work; authentication comes next so
 * an anonymous caller cannot consume somebody else's quota; the limit is
 * counted last and keyed on the account, which the caller cannot choose.
 */
export async function requireCustomer(
  request?: Request,
  limit: RateLimit = LIMITS.checkout,
  bucketPrefix = 'checkout',
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: NextResponse }> {
  if (request) {
    const rejected = crossOriginRejection(request);
    if (rejected) return { ok: false, response: rejected };
  }

  const user = await currentUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(UNAUTHENTICATED, { status: 401 }),
    };
  }

  const rate = await consume(`${bucketPrefix}:user:${user.id}`, limit);
  if (!rate.allowed) {
    return { ok: false, response: tooManyRequests(rate.resetSeconds) };
  }

  return { ok: true, user };
}

/**
 * Load an order the caller is entitled to act on.
 *
 * `hasOrderAccess` is the single definition of entitlement — owner, admin, or
 * the signed device cookie for a historical guest order — so the mutating
 * checkout endpoints cannot drift from what the order page allows.
 *
 * A caller with no entitlement gets **404, not 403**: distinguishing "not
 * yours" from "does not exist" turns an order number into an oracle, and order
 * numbers are guessable enough to matter. `/api/orders/[orderNumber]` already
 * takes the same line.
 */
export async function requireOrderAccess(
  orderNumber: string,
  request?: Request,
): Promise<{ ok: true; order: Order } | { ok: false; response: NextResponse }> {
  if (request) {
    const rejected = crossOriginRejection(request);
    if (rejected) return { ok: false, response: rejected };
  }

  const normalised = normaliseOrderNumber(orderNumber);
  const notFound = NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  if (!(await hasOrderAccess(normalised))) {
    return { ok: false, response: notFound };
  }

  // Counted only once entitlement is established, so an attacker probing other
  // people's order numbers cannot exhaust the real owner's quota.
  const user = await currentUser();
  const rate = await consume(
    `payment-action:${user ? `user:${user.id}` : `order:${normalised}`}`,
    LIMITS.paymentAction,
  );
  if (!rate.allowed) {
    return { ok: false, response: tooManyRequests(rate.resetSeconds) };
  }

  const order = await orders().findByOrderNumber(normalised);
  if (!order) return { ok: false, response: notFound };

  return { ok: true, order };
}
