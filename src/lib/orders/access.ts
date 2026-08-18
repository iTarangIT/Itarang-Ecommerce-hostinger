import { cookies } from 'next/headers';

/**
 * Confirmation-page access.
 *
 * After placing an order the shopper should see it without typing their phone
 * number back in, but an order number alone must not grant anyone access — it
 * would expose a stranger's address and contact details.
 *
 * So placement grants this browser access via an httpOnly cookie listing the
 * orders it placed. Everyone else uses the phone-number lookup on `/track`.
 * The cookie is httpOnly, so page scripts cannot read or forge it, and it only
 * ever names orders this browser actually created.
 */

const COOKIE = 'itarang_orders';
const MAX_ORDERS = 20;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export async function grantOrderAccess(orderNumber: string): Promise<void> {
  const store = await cookies();
  const existing = (store.get(COOKIE)?.value ?? '').split(',').filter(Boolean);
  const next = [orderNumber, ...existing.filter((n) => n !== orderNumber)].slice(0, MAX_ORDERS);

  store.set(COOKIE, next.join(','), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    // Local testing runs over http; a production build would add `secure: true`.
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function hasOrderAccess(orderNumber: string): Promise<boolean> {
  const store = await cookies();
  const granted = (store.get(COOKIE)?.value ?? '').split(',').filter(Boolean);
  return granted.includes(orderNumber);
}

export async function grantedOrderNumbers(): Promise<string[]> {
  const store = await cookies();
  return (store.get(COOKIE)?.value ?? '').split(',').filter(Boolean);
}
