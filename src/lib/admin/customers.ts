import { query, queryOne } from '@/lib/db/pool';
import { stateCode } from '@/lib/checkout/validation';

/**
 * Customer profiles by place, and what each of them bought.
 *
 * The console already answered "how much did each state spend?" — `geography()`
 * in `analytics.ts` — and "what did this one person do?" — `customerDetail()`
 * in `funnel.ts`. Neither answers the question the business actually asked,
 * which sits between them: *who* is buying in a city, and *what* have they
 * bought. This module is that middle layer, and it is deliberately a module
 * rather than a third query bolted onto one of the others: it joins customers
 * to places to products, which is a wider join than either of them wants.
 *
 * **Everything here reads `orders.shipping_address`, never
 * `customer_addresses`.** The order carries a jsonb snapshot of an address
 * goods were actually delivered to; the address book is current, editable, and
 * may never have been used. `0015_customer_addresses.sql` argues the point at
 * length for order history, and reporting by geography has exactly the same
 * exposure — sourcing it from the address book would move a customer, and their
 * purchase history with them, to a new city the moment they moved house.
 * `geography.integration.test.ts` holds that line for both surfaces.
 *
 * The window predicates are the three `revenue()` and `geography()` use — paid,
 * prepaid, bucketed by capture time — so the totals here reconcile with the
 * revenue reported elsewhere for the same period rather than telling a second
 * story about the same money.
 */

/** COD is out of scope for this phase, exactly as on the analytics page. */
const EXCLUDE_COD = `o.payment_method <> 'cod'`;

/**
 * Captured payments only, and `signature_verified` is part of it on purpose:
 * an unverified row is not evidence that money moved.
 */
const CAPTURED_AT = `(
  SELECT min(p.created_at)
    FROM payments p
   WHERE p.order_id = o.id
     AND p.status = 'paid'
     AND p.signature_verified
)`;

/**
 * City and state are typed by shoppers, so they are folded before grouping.
 *
 * `[[:space:]]` rather than a backslash class, for the reason `geography()`
 * records: a JavaScript string literal silently drops an unrecognised escape,
 * so a regex written as the obvious backslash-s reaches Postgres as a literal
 * "s" and quietly matches the wrong thing.
 */
function place(field: string): string {
  return `btrim(regexp_replace(COALESCE(o.shipping_address ->> '${field}', ''), '[[:space:]]+', ' ', 'g'))`;
}

export interface OrderedProduct {
  title: string;
  variantTitle: string | null;
  sku: string;
  /** Units across every paid order in the window. */
  quantity: number;
  /** Paise. */
  value: number;
}

export interface CustomerProfile {
  /**
   * Set only for a signed-in customer. Null for a guest, who has no account
   * page to link to — which is why the list renders their row without a link
   * rather than linking to a profile that does not exist.
   */
  userId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  /** Where their most recent paid order in the window went. */
  city: string;
  state: string;
  /** GST state code, when the name resolves to one. */
  stateCode: string | null;
  orders: number;
  /** Paise. */
  gross: number;
  /** ISO. First and last capture in the window. */
  firstOrderAt: string;
  lastOrderAt: string;
  /** Everything they bought, largest spend first. */
  products: OrderedProduct[];
}

export interface CustomerProfileFilters {
  /** Exact match against the folded, title-cased state name. */
  state?: string;
  city?: string;
  /** Substring against name, email and phone. */
  search?: string;
}

export interface CustomerProfilePage {
  rows: CustomerProfile[];
  /** Total matching customers, for pagination. */
  total: number;
}

/**
 * One identity per buyer, and the compromise in it is worth stating.
 *
 * A signed-in order is keyed on the account. A guest order is keyed on its
 * email address where there is one, so somebody who ordered twice as a guest is
 * one customer rather than two. An order with neither is keyed on itself.
 *
 * This is deliberately **not** the rule `geography()` uses. That function keys
 * every guest order on the order, because its "Customers" column is a count of
 * delivery relationships summed across cities and must not be read as a count
 * of people. Here the row *is* a person, so guest orders sharing an address
 * have to collapse — and the two figures can therefore differ for the same
 * period. The page says which is which.
 */
const CUSTOMER_KEY = `COALESCE(
  o.user_id::text,
  CASE WHEN NULLIF(btrim(o.customer_email), '') IS NOT NULL
       THEN 'email:' || lower(btrim(o.customer_email))
  END,
  'order:' || o.id::text
)`;

/**
 * The base scan: every paid, prepaid order in the window, folded and keyed.
 *
 * Shared by the page query and the count query so a filter can never apply to
 * one and not the other — the failure mode being a "1–25 of 300" that pages off
 * the end of a filtered list.
 *
 * Parameters are positional and fixed: $1 from, $2 to, $3 state, $4 city,
 * $5 search. Nulls mean "no filter", which is why each predicate is written as
 * `$n IS NULL OR …` rather than being assembled by string concatenation.
 */
const PAID_ORDERS = `
  SELECT o.id,
         o.user_id,
         o.total,
         o.customer_name,
         o.customer_phone,
         lower(btrim(o.customer_email)) AS order_email,
         initcap(lower(${place('state')})) AS state,
         initcap(lower(${place('city')}))  AS city,
         ${CUSTOMER_KEY} AS customer_key,
         ${CAPTURED_AT} AS captured_at
    FROM orders o
   WHERE o.payment_status = 'paid'
     AND ${EXCLUDE_COD}
     AND ${CAPTURED_AT} >= $1
     AND ${CAPTURED_AT} <  $2
     AND ($3::text IS NULL OR initcap(lower(${place('state')})) = $3)
     AND ($4::text IS NULL OR initcap(lower(${place('city')}))  = $4)
     AND ($5::text IS NULL OR
          o.customer_name  ILIKE '%' || $5 || '%' OR
          o.customer_email ILIKE '%' || $5 || '%' OR
          o.customer_phone ILIKE '%' || $5 || '%')`;

function params(from: Date, to: Date, filters: CustomerProfileFilters) {
  return [
    from,
    to,
    filters.state?.trim() || null,
    filters.city?.trim() || null,
    filters.search?.trim() || null,
  ];
}

/**
 * Customers who bought in the window, biggest spend first.
 *
 * The product list per customer is aggregated in SQL rather than by a second
 * round trip per row: twenty-five customers would otherwise be twenty-six
 * queries, and the console renders this table on every page of every filter.
 *
 * `json_agg` over a pre-grouped set, not over the raw join — grouping first is
 * what makes "two batteries" one line saying two rather than two lines saying
 * one each.
 */
export async function customerProfiles(
  from: Date,
  to: Date,
  filters: CustomerProfileFilters = {},
  limit = 25,
  offset = 0,
): Promise<CustomerProfilePage> {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 200);
  const skip = Math.max(0, Math.floor(offset));

  const [rows, count] = await Promise.all([
    query<{
      user_id: number | null;
      name: string;
      email: string | null;
      phone: string | null;
      city: string;
      state: string;
      orders: number;
      gross: string | number;
      first_order_at: Date;
      last_order_at: Date;
      products:
        | Array<{
            title: string;
            variant_title: string | null;
            sku: string;
            quantity: number;
            value: string | number;
          }>
        | null;
    }>(
      `WITH paid AS (${PAID_ORDERS}),
       totals AS (
         SELECT customer_key,
                count(*)::int AS orders,
                COALESCE(sum(total), 0)::bigint AS gross,
                min(captured_at) AS first_order_at,
                max(captured_at) AS last_order_at
           FROM paid
          GROUP BY customer_key
       ),
       latest AS (
         -- The identity and the place both come from the most recent paid
         -- order, so a customer who has moved is listed where their goods
         -- actually go now — while the history above still counts every order
         -- at the address it was delivered to.
         SELECT DISTINCT ON (customer_key)
                customer_key, user_id, customer_name, customer_phone,
                order_email, city, state
           FROM paid
          ORDER BY customer_key, captured_at DESC
       ),
       lines AS (
         SELECT p.customer_key,
                i.title,
                i.variant_title,
                i.sku,
                sum(i.quantity)::int AS quantity,
                COALESCE(sum(i.line_total), 0)::bigint AS value
           FROM paid p
           JOIN order_items i ON i.order_id = p.id
          GROUP BY p.customer_key, i.title, i.variant_title, i.sku
       ),
       bought AS (
         SELECT customer_key,
                json_agg(
                  json_build_object(
                    'title', title,
                    'variant_title', variant_title,
                    'sku', sku,
                    'quantity', quantity,
                    'value', value
                  ) ORDER BY value DESC
                ) AS products
           FROM lines
          GROUP BY customer_key
       )
       SELECT l.user_id,
              -- The account's name where there is one, because a customer can
              -- correct it; the order's otherwise, because a guest has no
              -- account to correct.
              COALESCE(NULLIF(btrim(u.full_name), ''), l.customer_name) AS name,
              COALESCE(u.email, l.order_email) AS email,
              l.customer_phone AS phone,
              l.city,
              l.state,
              t.orders,
              t.gross,
              t.first_order_at,
              t.last_order_at,
              b.products
         FROM totals t
         JOIN latest l ON l.customer_key = t.customer_key
         LEFT JOIN users u ON u.id = l.user_id
         LEFT JOIN bought b ON b.customer_key = t.customer_key
        ORDER BY t.gross DESC, t.last_order_at DESC
        LIMIT ${capped} OFFSET ${skip}`,
      params(from, to, filters),
    ),
    queryOne<{ total: number }>(
      `WITH paid AS (${PAID_ORDERS})
       SELECT count(DISTINCT customer_key)::int AS total FROM paid`,
      params(from, to, filters),
    ),
  ]);

  return {
    total: count?.total ?? 0,
    rows: rows.map((row) => ({
      userId: row.user_id,
      name: row.name || '—',
      email: row.email,
      phone: row.phone,
      city: row.city,
      state: row.state,
      stateCode: stateCode(row.state) ?? null,
      orders: row.orders,
      gross: Number(row.gross),
      firstOrderAt: row.first_order_at.toISOString(),
      lastOrderAt: row.last_order_at.toISOString(),
      products: (row.products ?? []).map((product) => ({
        title: product.title,
        variantTitle: product.variant_title,
        sku: product.sku,
        quantity: product.quantity,
        value: Number(product.value),
      })),
    })),
  };
}

/**
 * Every state and city with at least one paid order in the window.
 *
 * Feeds the filter controls, so it is the list of places that actually have
 * customers rather than the checkout's full `STATES` list — a dropdown of
 * thirty-six states of which four have ever received an order is a dropdown
 * nobody can use.
 */
export interface PlaceOption {
  state: string;
  cities: string[];
}

export async function customerPlaces(from: Date, to: Date): Promise<PlaceOption[]> {
  const rows = await query<{ state: string; city: string }>(
    `SELECT DISTINCT
            initcap(lower(${place('state')})) AS state,
            initcap(lower(${place('city')}))  AS city
       FROM orders o
      WHERE o.payment_status = 'paid'
        AND ${EXCLUDE_COD}
        AND ${CAPTURED_AT} >= $1
        AND ${CAPTURED_AT} <  $2
        AND ${place('state')} <> ''
      ORDER BY state, city`,
    [from, to],
  );

  const byState = new Map<string, string[]>();
  for (const row of rows) {
    const cities = byState.get(row.state) ?? [];
    if (row.city !== '') cities.push(row.city);
    byState.set(row.state, cities);
  }

  return [...byState.entries()].map(([state, cities]) => ({ state, cities }));
}

/**
 * What one customer has bought, over their whole history.
 *
 * Unwindowed, unlike everything above, and that is the point: this hangs off a
 * named person's profile, where "what has this customer ever bought from us?"
 * is the question, not "what did they buy last month?".
 *
 * Guests are unreachable here by construction — the profile page is keyed on a
 * user id, and a guest has none.
 */
export async function customerPurchases(userId: number): Promise<OrderedProduct[]> {
  const rows = await query<{
    title: string;
    variant_title: string | null;
    sku: string;
    quantity: number;
    value: string | number;
  }>(
    `SELECT i.title,
            i.variant_title,
            i.sku,
            sum(i.quantity)::int AS quantity,
            COALESCE(sum(i.line_total), 0)::bigint AS value
       FROM orders o
       JOIN order_items i ON i.order_id = o.id
      WHERE o.user_id = $1
        AND o.payment_status = 'paid'
        AND ${EXCLUDE_COD}
      GROUP BY i.title, i.variant_title, i.sku
      ORDER BY value DESC`,
    [userId],
  );

  return rows.map((row) => ({
    title: row.title,
    variantTitle: row.variant_title,
    sku: row.sku,
    quantity: row.quantity,
    value: Number(row.value),
  }));
}
