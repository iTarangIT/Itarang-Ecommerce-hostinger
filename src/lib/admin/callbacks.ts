import { query } from '@/lib/db/pool';

/**
 * Admin → Call-backs: "Started checkout, not paid" (R-13).
 *
 * The funnel says how many shoppers stopped at checkout; the sales team needs
 * *who*, with a number to ring. Two kinds of row, because there are two ways
 * to stop:
 *
 * 1. **An order that was never paid** — placed, payment window opened, closed
 *    or failed. Everything is on the order: mobile, products, amount, pincode.
 *    It leaves the list by itself the moment it is paid or cancelled, because
 *    the predicate is the order's own status.
 *
 * 2. **A signed-in shopper who reached checkout and placed nothing.** Checkout
 *    requires an account (until R-02), so `begin_checkout` carries the user;
 *    the mobile is the account's, and the products are what that session put
 *    in the cart or bought now. It leaves the list once that account places
 *    any order after the checkout visit — an unpaid one moves to kind 1.
 *
 * Anonymous visitors who stopped at the login wall have no number at all and
 * are not listed; that is the gap mobile-number checkout (R-02) closes.
 *
 * "Called" is a tick, not a state: each press adds a row to
 * `checkout_callbacks` with who and when, and the list shows the latest. A
 * shopper who comes back to checkout after being called shows as not called
 * again, because the tick is compared with the newer visit.
 */

/** How far back the list reaches. Older than this, the moment has passed. */
export const CALLBACK_WINDOW_DAYS = 14;

export interface CallbackRow {
  kind: 'order' | 'account';
  /** The order id or the user id, by kind — what the Called tick is keyed on. */
  subjectId: number;
  orderNumber?: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  /** Product titles, or product ids for an account row (resolved by the page). */
  products: string[];
  /** Paise. Exact for an order; for an account row, the cart value seen. */
  amount: number | null;
  pincode: string | null;
  startedAt: string;
  paymentStatus?: string;
  isTest: boolean;
  calledBy?: string;
  calledAt?: string;
  note?: string;
}

export async function listCallbacks(
  options: { includeCalled?: boolean } = {},
): Promise<CallbackRow[]> {
  const days = String(CALLBACK_WINDOW_DAYS);

  const unpaid = await query<{
    id: number;
    order_number: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    total: string;
    pincode: string | null;
    created_at: Date;
    payment_status: string;
    is_test: boolean;
    products: string[] | null;
    called_by: string | null;
    called_at: Date | null;
    note: string | null;
  }>(
    `SELECT o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_email, o.total,
            o.shipping_address->>'pincode' AS pincode, o.created_at, o.payment_status, o.is_test,
            (SELECT array_agg(i.title || CASE WHEN i.quantity > 1 THEN ' × ' || i.quantity ELSE '' END
                              ORDER BY i.id)
               FROM order_items i WHERE i.order_id = o.id) AS products,
            c.called_by, c.called_at, c.note
       FROM orders o
       LEFT JOIN LATERAL (
         SELECT called_by, called_at, note FROM checkout_callbacks
          WHERE order_id = o.id ORDER BY called_at DESC LIMIT 1
       ) c ON true
      WHERE o.status = 'pending_payment'
        AND o.payment_method <> 'cod'
        AND o.created_at >= now() - ($1 || ' days')::interval
        -- Paid since, on another order with the same number: nothing to chase.
        AND NOT EXISTS (
          SELECT 1 FROM orders paid
           WHERE paid.customer_phone = o.customer_phone
             AND paid.payment_status = 'paid'
             AND paid.created_at > o.created_at
        )
      ORDER BY o.created_at DESC
      LIMIT 300`,
    [days],
  );

  const accounts = await query<{
    user_id: number;
    full_name: string | null;
    phone: string | null;
    email: string;
    started_at: Date;
    product_ids: string[] | null;
    amount: string | null;
    pincode: string | null;
    called_by: string | null;
    called_at: Date | null;
    note: string | null;
  }>(
    `WITH last_visit AS (
       SELECT DISTINCT ON (f.user_id) f.user_id, f.session_id, f.occurred_at
         FROM funnel_events f
        WHERE f.event = 'begin_checkout'
          AND f.user_id IS NOT NULL
          AND f.occurred_at >= now() - ($1 || ' days')::interval
        ORDER BY f.user_id, f.occurred_at DESC
     )
     SELECT v.user_id, u.full_name, u.phone, u.email, v.occurred_at AS started_at,
            cart.product_ids, cart.amount,
            (SELECT a.pincode FROM customer_addresses a
              WHERE a.user_id = v.user_id ORDER BY a.created_at DESC LIMIT 1) AS pincode,
            c.called_by, c.called_at, c.note
       FROM last_visit v
       JOIN users u ON u.id = v.user_id AND u.role = 'customer'
       LEFT JOIN LATERAL (
         -- What this session was buying: the latest value seen per product.
         SELECT array_agg(p.product_id ORDER BY p.product_id) AS product_ids,
                sum(p.value)::bigint AS amount
           FROM (
             SELECT DISTINCT ON (e.product_id) e.product_id, e.value
               FROM funnel_events e
              WHERE e.session_id = v.session_id
                AND e.event IN ('add_to_cart', 'buy_now')
                AND e.product_id IS NOT NULL
              ORDER BY e.product_id, e.occurred_at DESC
           ) p
       ) cart ON true
       LEFT JOIN LATERAL (
         SELECT called_by, called_at, note FROM checkout_callbacks
          WHERE user_id = v.user_id ORDER BY called_at DESC LIMIT 1
       ) c ON true
      WHERE NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.user_id = v.user_id AND o.created_at >= v.occurred_at
      )
      ORDER BY v.occurred_at DESC
      LIMIT 300`,
    [days],
  );

  const rows: CallbackRow[] = [
    ...unpaid.map((row) => ({
      kind: 'order' as const,
      subjectId: row.id,
      orderNumber: row.order_number,
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email,
      products: row.products ?? [],
      amount: Number(row.total),
      pincode: row.pincode,
      startedAt: row.created_at.toISOString(),
      paymentStatus: row.payment_status,
      isTest: row.is_test,
      calledBy: row.called_by ?? undefined,
      calledAt: row.called_at?.toISOString(),
      note: row.note ?? undefined,
    })),
    ...accounts.map((row) => ({
      kind: 'account' as const,
      subjectId: row.user_id,
      name: row.full_name,
      phone: row.phone,
      email: row.email,
      products: row.product_ids ?? [],
      amount: row.amount === null ? null : Number(row.amount),
      pincode: row.pincode,
      startedAt: row.started_at.toISOString(),
      isTest: false,
      // A call made before the latest checkout visit does not count for it.
      ...(row.called_at && row.called_at >= row.started_at
        ? { calledBy: row.called_by ?? undefined, calledAt: row.called_at.toISOString(), note: row.note ?? undefined }
        : {}),
    })),
  ].sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return options.includeCalled ? rows : rows.filter((row) => !row.calledAt);
}

/** The "Called" tick. Keyed by order or by account, never both (the table checks). */
export async function markCalled(input: {
  kind: CallbackRow['kind'];
  subjectId: number;
  calledBy: string;
  note?: string;
}): Promise<void> {
  await query(
    `INSERT INTO checkout_callbacks (order_id, user_id, called_by, note) VALUES ($1, $2, $3, $4)`,
    [
      input.kind === 'order' ? input.subjectId : null,
      input.kind === 'account' ? input.subjectId : null,
      input.calledBy,
      input.note ?? null,
    ],
  );
}
