import { randomUUID, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { query } from '@/lib/db/pool';

/**
 * Funnel event capture.
 *
 * Only the five stages nothing else records live here. Registration, payment
 * initiation, payment capture and order placement are *derived* from `users`,
 * `payment_attempts`, `payments` and `order_events`, which are already
 * authoritative — see `db/migrations/0009_funnel_events.sql` for the full
 * split and why it is drawn there.
 *
 * Three rules govern everything below.
 *
 * **Identity is never taken from the client.** `visitor_id` lives in an
 * HttpOnly cookie the server mints, so a request body cannot supply one, and
 * `user_id` is resolved from the session on the server. A browser can lie about
 * what it did; it cannot lie about who it is.
 *
 * **Writes are idempotent.** Every event carries a `dedupe_key` under a unique
 * constraint, so a retried beacon, a double-fired effect under React strict
 * mode, or a deliberate replay all collapse to one row.
 *
 * **Nothing here may fail a request.** Analytics is not worth a 500 on a
 * product page, so `record()` swallows its own errors after logging them. The
 * caller is never given a reason to care.
 */

/**
 * Separator for the dedupe key's parts.
 *
 * A NUL, because product and variant ids are opaque upstream strings and a
 * printable separator could in principle appear inside one — which would let
 * two different events hash to the same key. Written as an escape rather than
 * a literal control character so it is visible to a reader and survives any
 * tool that rewrites the file.
 */
const SEPARATOR = '\u0000';

const VISITOR_COOKIE = 'itarang_vid';
const SESSION_COOKIE = 'itarang_vsid';

/** A visit is one browsing session; 30 minutes of inactivity ends it. */
const SESSION_MINUTES = 30;
/** Long enough to see a returning shopper, short enough not to be a fingerprint. */
const VISITOR_DAYS = 180;

const DAY_SECONDS = 24 * 60 * 60;

export const FUNNEL_EVENTS = [
  'visit',
  'product_view',
  'buy_now',
  'add_to_cart',
  /**
   * The login wall.
   *
   * An anonymous visitor reached /checkout and was bounced to /login. Because
   * placing an order requires an account, this is the last stage an unregistered
   * visitor can reach, and the largest single drop in the product. Written
   * server-side for the same reason `begin_checkout` is — see 0011.
   */
  'checkout_intent',
  'begin_checkout',
] as const;

export type FunnelEventName = (typeof FUNNEL_EVENTS)[number];

export function isFunnelEvent(value: unknown): value is FunnelEventName {
  return typeof value === 'string' && (FUNNEL_EVENTS as readonly string[]).includes(value);
}

export interface VisitorContext {
  visitorId: string;
  sessionId: string;
  /** True when this request created the visitor — i.e. a genuinely new browser. */
  freshVisitor: boolean;
  /** True when this request started a new browsing session. */
  freshSession: boolean;
}

export interface RecordInput {
  event: FunnelEventName;
  visitor: VisitorContext;
  userId?: number | null;
  productId?: string | null;
  variantId?: string | null;
  quantity?: number | null;
  /** Paise. */
  value?: number | null;
  /**
   * Caller-supplied idempotency scope. Two beacons for the same event, session
   * and product collapse when this matches — which is what makes a retry safe.
   */
  dedupe?: string;
}

/**
 * Read the visitor cookies, minting them when absent.
 *
 * Only callable from a Route Handler or Server Action: Next.js does not permit
 * writing a cookie during an ordinary page render, which is precisely why the
 * beacon posts to `/api/events` rather than being recorded inside the page.
 */
export async function visitorContext(): Promise<VisitorContext> {
  const store = await cookies();

  const existingVisitor = store.get(VISITOR_COOKIE)?.value;
  const existingSession = store.get(SESSION_COOKIE)?.value;

  const visitorId = isUuid(existingVisitor) ? existingVisitor : randomUUID();
  const sessionId = isUuid(existingSession) ? existingSession : randomUUID();

  const freshVisitor = visitorId !== existingVisitor;
  const freshSession = sessionId !== existingSession;

  const common = {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  } as const;

  // Rewritten on every event, so the session cookie's own expiry *is* the
  // inactivity window — no server-side clock needed to close a session.
  store.set(VISITOR_COOKIE, visitorId, { ...common, maxAge: VISITOR_DAYS * DAY_SECONDS });
  store.set(SESSION_COOKIE, sessionId, { ...common, maxAge: SESSION_MINUTES * 60 });

  return { visitorId, sessionId, freshVisitor, freshSession };
}

/**
 * Read the visitor cookies without minting. Safe during a page render.
 *
 * All-or-nothing on purpose: a `funnel_events` row needs both ids, so there is
 * nothing useful to return when only one survives.
 *
 * That makes it the wrong function for anything that needs only a visitor —
 * `itarang_vsid` lapses after 30 minutes while `itarang_vid` lives for 180 days,
 * so a returning shopper has a perfectly good visitor id and no session, and
 * this returns `null` for them. Attribution used to be lost exactly there: a
 * sign-in a week later, or an order placed after half an hour on the checkout
 * page. Callers that can write cookies use `visitorContext()` instead, which
 * mints the missing half rather than discarding the surviving one.
 */
export async function peekVisitor(): Promise<{ visitorId: string; sessionId: string } | null> {
  const store = await cookies();
  const visitorId = store.get(VISITOR_COOKIE)?.value;
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!isUuid(visitorId) || !isUuid(sessionId)) return null;
  return { visitorId, sessionId };
}

function isUuid(value: string | undefined): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

/**
 * The idempotency key.
 *
 * Hashed rather than concatenated so an unbounded product id cannot produce an
 * unbounded index entry, and so the column never carries anything legible.
 */
function dedupeKey(input: RecordInput): string {
  const parts = [
    input.event,
    input.visitor.sessionId,
    input.productId ?? '',
    input.variantId ?? '',
    input.dedupe ?? '',
  ];
  return createHash('sha256').update(parts.join(SEPARATOR)).digest('hex').slice(0, 32);
}

/**
 * Write one funnel event.
 *
 * Returns true when a row was actually inserted; false means the event was a
 * duplicate, or the write failed and was logged. No caller should branch on it
 * except tests — it exists so idempotency is observable.
 */
export async function record(input: RecordInput): Promise<boolean> {
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO funnel_events
         (event, visitor_id, session_id, user_id, product_id, variant_id,
          quantity, value, dedupe_key)
       VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [
        input.event,
        input.visitor.visitorId,
        input.visitor.sessionId,
        input.userId ?? null,
        input.productId ?? null,
        input.variantId ?? null,
        input.quantity ?? null,
        input.value ?? null,
        dedupeKey(input),
      ],
    );
    return rows.length > 0;
  } catch (error) {
    // Deliberately swallowed. A funnel row is never worth failing a page or a
    // checkout step for, and the table may legitimately not exist yet on an
    // install that has not run 0009.
    console.warn(`[funnel] dropped ${input.event}: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Link anonymous browsing to an account.
 *
 * Called at sign-in and registration. The link is additive and resolved at
 * query time — prior events keep the `user_id` they had when they happened,
 * because rewriting history would misreport what was known at the time and
 * would have to be redone on every new device.
 */
export async function linkVisitorToUser(visitorId: string, userId: number): Promise<void> {
  try {
    await query(
      `INSERT INTO visitor_identities (visitor_id, user_id)
       VALUES ($1::uuid, $2)
       ON CONFLICT (visitor_id, user_id) DO NOTHING`,
      [visitorId, userId],
    );
  } catch (error) {
    console.warn(`[funnel] could not link visitor: ${(error as Error).message}`);
  }
}

/** Record which anonymous session produced an order. */
export async function attributeOrder(
  orderId: number,
  visitor: { visitorId: string; sessionId: string } | null,
): Promise<void> {
  if (!visitor) return;
  try {
    await query(
      `INSERT INTO order_attribution (order_id, visitor_id, session_id)
       VALUES ($1, $2::uuid, $3::uuid)
       ON CONFLICT (order_id) DO NOTHING`,
      [orderId, visitor.visitorId, visitor.sessionId],
    );
  } catch (error) {
    console.warn(`[funnel] could not attribute order ${orderId}: ${(error as Error).message}`);
  }
}
