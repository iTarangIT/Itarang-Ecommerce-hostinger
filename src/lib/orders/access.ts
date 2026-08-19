import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { currentUser } from '@/lib/auth/session';
import { orders } from './postgres-repository';

/**
 * Who may open an order.
 *
 * There are now two answers, and the order they are tried in matters:
 *
 * 1. **Ownership** — `orders.user_id` matches the signed-in account, or the
 *    caller is an admin. This is the path every new order takes, and it is a
 *    foreign key comparison, not a guess.
 *
 * 2. **The legacy device cookie** — a list of order numbers this browser
 *    placed, from before checkout required an account. Kept so that historical
 *    guest orders remain reachable from the device that created them.
 *
 * The cookie used to be an unsigned comma-separated list, defended only by
 * `httpOnly`. That defends against page scripts and nothing else: `httpOnly`
 * does not stop a client sending `Cookie: itarang_orders=<order-number>`
 * directly, so anyone who guessed an order number could read a stranger's
 * name, phone, email and address. It is now HMAC-signed with the same
 * construction the session tokens use, so a value this server did not issue is
 * rejected.
 */

const COOKIE = 'itarang_orders';
const MAX_ORDERS = 20;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * The signing key.
 *
 * Derived from `DATABASE_URL` rather than introducing another secret to
 * deploy and rotate. It is server-only, already required for the app to
 * function at all, and never leaves the process — and if it changes, the worst
 * outcome is that old order cookies stop validating and the customer falls
 * back to `/track`, which is a lost convenience rather than lost access.
 */
function signingKey(): string {
  return process.env.DATABASE_URL ?? '';
}

function sign(value: string): string {
  return createHmac('sha256', signingKey()).update(value).digest('hex');
}

function verify(value: string, signature: string): boolean {
  const expected = sign(value);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    // Buffer.from silently truncates invalid hex, which can leave the two
    // buffers different lengths and make timingSafeEqual throw.
    return false;
  }
}

function readGranted(raw: string | undefined): string[] {
  if (!raw) return [];

  const separator = raw.lastIndexOf('.');
  if (separator === -1) return [];

  const value = raw.slice(0, separator);
  if (!verify(value, raw.slice(separator + 1))) return [];

  return value.split(',').filter(Boolean);
}

/** Record that this browser placed an order. */
export async function grantOrderAccess(orderNumber: string): Promise<void> {
  const store = await cookies();
  const existing = readGranted(store.get(COOKIE)?.value);
  const next = [orderNumber, ...existing.filter((n) => n !== orderNumber)].slice(0, MAX_ORDERS);

  const value = next.join(',');
  store.set(COOKIE, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * True when the caller may open this order.
 *
 * Checks ownership first and falls back to the signed device cookie, so a
 * customer signed in on a new device still reaches their own orders, and a
 * historical guest order still opens on the device that placed it.
 */
export async function hasOrderAccess(orderNumber: string): Promise<boolean> {
  const user = await currentUser();

  if (user) {
    if (user.role === 'admin') return true;

    const owned = await orders().findForOwner(orderNumber, user.id);
    if (owned) return true;
  }

  const store = await cookies();
  return readGranted(store.get(COOKIE)?.value).includes(orderNumber);
}

/** The order numbers this browser placed, for the account area. */
export async function grantedOrderNumbers(): Promise<string[]> {
  const store = await cookies();
  return readGranted(store.get(COOKIE)?.value);
}
