import { query } from '@/lib/db/pool';
import type { CategorySlug } from '@/lib/commerce/types';

/**
 * The admin out-of-stock list.
 *
 * Reads `product_variants.stock` directly — the same column the pricing form
 * writes and the order path decrements. **No second inventory source is
 * created here**: this is a view over the existing one, and nothing in this
 * module writes a quantity.
 *
 * Sold quantity is derived at read time from `order_items`, not stored. A
 * counter column would be a second number that has to be kept in step with the
 * orders it counts, and the first time the two disagreed nobody would know
 * which was right.
 *
 * Admin-only, and deliberately full of the figures the storefront no longer
 * shows: the customer-facing change was about what shoppers see, and the
 * business still needs the real numbers to work from.
 */

export interface OutOfStockRow {
  productKey: string;
  title: string;
  brand: string | null;
  modelName: string | null;
  category: CategorySlug;
  subcategory: string;
  status: string;
  sku: string;
  variantTitle: string;
  /** The real count. Zero here by definition; kept for the column. */
  stock: number;
  mrp: number | null;
  selling: number | null;
  /** Units sold across paid orders, derived from `order_items`. */
  soldQuantity: number;
  /** People who explicitly asked to be told when it returns. */
  waitingCount: number;
  /** When it went out of stock, if a transition recorded it. */
  wentOutOfStockAt: string | null;
  /** True when the internal alert for that transition has not gone out. */
  alertPending: boolean;
}

/**
 * Order states that count as a sale.
 *
 * The values of the `order_status` enum in `0001_checkout.sql`, minus the two
 * that are not sales: `pending_payment` is an order nobody has paid for, and
 * `cancelled` is one that was undone. Counting either would overstate demand
 * for exactly the products this page exists to make a restocking decision
 * about.
 *
 * Compared as text — `o.status::text = ANY(...)` — because the column is an
 * enum and a text array will not implicitly coerce to it.
 */
const SOLD_STATUSES = ['confirmed', 'packed', 'shipped', 'delivered'];

export async function listOutOfStock(): Promise<OutOfStockRow[]> {
  const rows = await query<{
    product_key: string;
    title: string;
    brand: string | null;
    model_name: string | null;
    category: CategorySlug;
    subcategory: string;
    status: string;
    sku: string;
    variant_title: string;
    stock: number;
    mrp: number | null;
    selling: number | null;
    sold_quantity: number;
    waiting_count: number;
    went_out_of_stock_at: Date | null;
    alert_pending: boolean;
  }>(
    `SELECT p.product_key,
            p.title,
            p.brand,
            p.model_name,
            p.category,
            p.subcategory,
            p.status,
            v.sku,
            v.title AS variant_title,
            v.stock,
            v.mrp,
            v.selling,
            COALESCE(sold.quantity, 0)::int AS sold_quantity,
            COALESCE(waiting.count, 0)::int AS waiting_count,
            latest.occurred_at AS went_out_of_stock_at,
            COALESCE(latest.alert_sent_at IS NULL, false) AS alert_pending
       FROM product_variants v
       JOIN products p ON p.id = v.product_id

       -- Derived, never stored. Joined on the SKU snapshot the invoice was
       -- built from, which is why order_items.sku exists.
       LEFT JOIN LATERAL (
         SELECT sum(oi.quantity) AS quantity
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.sku = v.sku AND o.status::text = ANY($1::text[])
       ) sold ON true

       LEFT JOIN LATERAL (
         SELECT count(*) AS count
           FROM stock_notification_requests r
          WHERE r.product_id = p.product_key AND r.cancelled_at IS NULL
       ) waiting ON true

       -- The most recent crossing for this SKU, whichever direction. Filtered
       -- to 'out-of-stock' below so a restock does not present as pending.
       LEFT JOIN LATERAL (
         SELECT t.occurred_at, t.alert_sent_at
           FROM stock_transitions t
          WHERE t.sku = v.sku AND t.direction = 'out-of-stock'
          ORDER BY t.occurred_at DESC
          LIMIT 1
       ) latest ON true

      -- Exactly zero. A NULL stock is untracked, not sold out
      -- (see 0012_product_catalogue.sql), and listing untracked variants here
      -- would fill the page with products nobody counts.
      WHERE v.stock = 0
      ORDER BY latest.occurred_at DESC NULLS LAST, p.title, v.sku`,
    [SOLD_STATUSES],
  );

  return rows.map((row) => ({
    productKey: row.product_key,
    title: row.title,
    brand: row.brand,
    modelName: row.model_name,
    category: row.category,
    subcategory: row.subcategory,
    status: row.status,
    sku: row.sku,
    variantTitle: row.variant_title,
    stock: row.stock,
    mrp: row.mrp,
    selling: row.selling,
    soldQuantity: row.sold_quantity,
    waitingCount: row.waiting_count,
    wentOutOfStockAt: row.went_out_of_stock_at
      ? row.went_out_of_stock_at.toISOString()
      : null,
    alertPending: row.alert_pending,
  }));
}

/** Sold units for one product's variants, for the interested-customers panel. */
export async function soldQuantitiesFor(productKey: string): Promise<Map<string, number>> {
  const rows = await query<{ sku: string; quantity: number }>(
    // A LATERAL rather than a LEFT JOIN to `orders` with the status in the ON
    // clause: that shape leaves the `order_items` row in the result with a NULL
    // order beside it, so its quantity still reaches the SUM and unpaid and
    // cancelled orders are counted as sales.
    `SELECT v.sku, COALESCE(sold.quantity, 0)::int AS quantity
       FROM product_variants v
       JOIN products p ON p.id = v.product_id
       LEFT JOIN LATERAL (
         SELECT sum(oi.quantity) AS quantity
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.sku = v.sku AND o.status::text = ANY($2::text[])
       ) sold ON true
      WHERE p.product_key = $1`,
    [productKey, SOLD_STATUSES],
  );
  return new Map(rows.map((row) => [row.sku, row.quantity]));
}
