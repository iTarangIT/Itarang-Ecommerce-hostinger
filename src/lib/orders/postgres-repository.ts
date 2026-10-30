import type { PoolClient } from 'pg';
import { revalidateTag } from 'next/cache';
import { query, queryOne, transaction } from '@/lib/db/pool';
import { countRedemptions } from '@/lib/offers/campaign-store';
import { dispatchStockAlertsInBackground } from '@/lib/stock/alerts';
import { recordStockTransitions, transitionBetween } from '@/lib/stock/transitions';
import { generateOrderNumber } from './numbering';
import { notifyOrderPaidInBackground } from './notify';
import {
  canTransitionOrder,
  canTransitionPayment,
  isPaymentAdvance,
  orderStatusForPayment,
} from './state-machine';
import type {
  CreateOrderInput,
  CreateOrderResult,
  CustomerAwareRepository,
  CustomerOrderStats,
  OrderListFilters,
  OrderRepository,
  OrderSort,
} from './repository';
import type {
  Order,
  OrderEvent,
  Shipment,
  OrderItem,
  OrderStatus,
  PaymentRecord,
  PaymentStatus,
  RefundRecord,
  RefundStatus,
  StockReservation,
} from './types';

/**
 * PostgreSQL implementation of `OrderRepository`, against the local
 * `itarang_dev` database.
 *
 * Two things are load-bearing here and worth reading closely:
 *
 * 1. **Order creation and stock reservation share one transaction**, and that
 *    transaction locks the `inventory_baseline` row for every variant involved.
 *    Locking the baseline rather than existing reservations is what makes the
 *    check correct: two concurrent checkouts for a variant with no prior
 *    reservations would otherwise both find "nothing reserved" and both succeed.
 *
 * 2. **Reservation expiry is evaluated on read.** Availability never counts a
 *    reservation past `expires_at`, so correctness does not depend on the sweep
 *    job having run.
 */

/* ------------------------------------------------------------- row types */

interface OrderRow {
  id: number;
  order_number: string;
  /** Null on guest orders placed before accounts existed. */
  user_id: number | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  shipping_address: Order['shippingAddress'];
  subtotal: number;
  product_savings: number;
  coupon_code: string | null;
  coupon_discount: number;
  payment_discount: number;
  shipping: number;
  cod_fee: number;
  total: number;
  gst_amount: number;
  gst_rate: number;
  place_of_supply: string | null;
  buyer_gstin: string | null;
  seller_gstin: string | null;
  payment_method: Order['paymentMethod'];
  is_test: boolean;
  idempotency_key: string | null;
  gateway_order_id: string | null;
  paid_at: Date | null;
  confirmed_at: Date | null;
  packed_at: Date | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  delivery_person: string | null;
  delivery_phone: string | null;
  terms_accepted_at: Date | null;
  cancellation_requested_at: Date | null;
  cancellation_request_note: string | null;
  placed_by: string | null;
  payment_link_id: string | null;
  payment_link_url: string | null;
  created_at: Date;
  updated_at: Date;
}

interface OrderItemRow {
  order_id: number;
  product_id: string;
  variant_id: string;
  sku: string;
  title: string;
  variant_title: string | null;
  image: string | null;
  unit_mrp: number;
  unit_price: number;
  quantity: number;
  line_total: number;
  hsn_code: string | null;
  tax_rate: number;
  installation_included: boolean;
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    productId: row.product_id,
    variantId: row.variant_id,
    sku: row.sku,
    title: row.title,
    variantTitle: row.variant_title ?? undefined,
    image: row.image ?? undefined,
    unitMrp: row.unit_mrp,
    unitPrice: row.unit_price,
    quantity: row.quantity,
    lineTotal: row.line_total,
    hsnCode: row.hsn_code ?? undefined,
    taxRate: row.tax_rate,
    installationIncluded: row.installation_included,
  };
}

function toOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id ?? undefined,
    status: row.status,
    paymentStatus: row.payment_status,
    contact: {
      name: row.customer_name,
      phone: row.customer_phone,
      email: row.customer_email ?? undefined,
    },
    shippingAddress: row.shipping_address,
    amounts: {
      subtotal: row.subtotal,
      productSavings: row.product_savings,
      couponCode: row.coupon_code ?? undefined,
      couponDiscount: row.coupon_discount,
      paymentDiscount: row.payment_discount,
      shipping: row.shipping,
      codFee: row.cod_fee,
      total: row.total,
      gstAmount: row.gst_amount,
      gstRate: row.gst_rate,
    },
    items,
    paymentMethod: row.payment_method,
    isTest: row.is_test,
    placeOfSupply: row.place_of_supply ?? undefined,
    buyerGstin: row.buyer_gstin ?? undefined,
    sellerGstin: row.seller_gstin ?? undefined,
    idempotencyKey: row.idempotency_key ?? undefined,
    gatewayOrderId: row.gateway_order_id ?? undefined,
    stages: {
      paidAt: row.paid_at?.toISOString(),
      confirmedAt: row.confirmed_at?.toISOString(),
      packedAt: row.packed_at?.toISOString(),
      shippedAt: row.shipped_at?.toISOString(),
      deliveredAt: row.delivered_at?.toISOString(),
      cancelledAt: row.cancelled_at?.toISOString(),
    },
    shipment: {
      courierName: row.courier_name ?? undefined,
      trackingNumber: row.tracking_number ?? undefined,
      trackingUrl: row.tracking_url ?? undefined,
      deliveryPerson: row.delivery_person ?? undefined,
      deliveryPhone: row.delivery_phone ?? undefined,
    },
    termsAcceptedAt: row.terms_accepted_at?.toISOString(),
    cancellationRequest: row.cancellation_requested_at
      ? {
          requestedAt: row.cancellation_requested_at.toISOString(),
          note: row.cancellation_request_note ?? undefined,
        }
      : undefined,
    placedBy: row.placed_by ?? undefined,
    paymentLink:
      row.payment_link_id && row.payment_link_url
        ? { id: row.payment_link_id, url: row.payment_link_url }
        : undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const ORDER_COLUMNS = `
  id, order_number, user_id, status, payment_status,
  customer_name, customer_phone, customer_email, shipping_address,
  subtotal, product_savings, coupon_code, coupon_discount, payment_discount, shipping, cod_fee,
  total, gst_amount, gst_rate, place_of_supply, buyer_gstin, seller_gstin,
  payment_method, is_test, idempotency_key, gateway_order_id,
  paid_at, confirmed_at, packed_at, shipped_at, delivered_at, cancelled_at,
  courier_name, tracking_number, tracking_url, delivery_person, delivery_phone,
  terms_accepted_at, cancellation_requested_at, cancellation_request_note,
  placed_by, payment_link_id, payment_link_url, created_at, updated_at`;

/**
 * The column that records when an order first reached a status. Fixed
 * strings only, never built from input. `pending_payment` has none: that is
 * `created_at`.
 */
const STAGE_COLUMN: Partial<Record<OrderStatus, string>> = {
  confirmed: 'confirmed_at',
  packed: 'packed_at',
  shipped: 'shipped_at',
  delivered: 'delivered_at',
  cancelled: 'cancelled_at',
};

/** `, confirmed_at = COALESCE(confirmed_at, now())`: the first arrival wins. */
function stampStage(status: OrderStatus): string {
  const column = STAGE_COLUMN[status];
  return column ? `, ${column} = COALESCE(${column}, now())` : '';
}

/**
 * After a transaction that sold stock has committed: let the storefront see
 * the new number, and send any out-of-stock alert.
 *
 * Every catalogue read goes through `unstable_cache` tagged `catalog` in
 * `commerce/db/db-provider.ts`, and that cache is what a product page, a
 * product card and the category grids are rendered from. Without the purge the
 * sale is in the database and the shop goes on advertising the old count until
 * something else happens to purge it. Done after the commit — purging while the
 * new number is still uncommitted would let a racing read repopulate the old
 * one.
 *
 * Both halves are non-fatal. `revalidateTag` is only callable from a Server
 * Action or Route Handler, and this is also reachable from scripts and the test
 * suite; the alert is an SMTP round trip. Neither may undo a sale already
 * recorded — an unsent alert is still visible in the admin out-of-stock list.
 */
function afterStockChange(stockChanged: boolean, transitionRecorded: boolean): void {
  if (stockChanged) {
    try {
      revalidateTag('catalog');
    } catch (error) {
      console.warn(
        `[inventory] stock changed but the catalogue cache was not purged: ${
          (error as Error).message
        }`,
      );
    }
  }
  if (transitionRecorded) dispatchStockAlertsInBackground();
}

/** The only columns a caller's `sort` can reach — never interpolated from input. */
const ORDER_SORT_COLUMNS: Record<OrderSort, string> = {
  placed: 'created_at',
  updated: 'updated_at',
  total: 'total',
  customer: 'customer_name',
};

/**
 * The WHERE clause shared by the order list and its status counts, so a count
 * chip can never disagree with the rows it filters to.
 *
 * Dates are IST calendar days, inclusive at both ends: `placedTo` becomes the
 * start of the following day, exclusive, so an order at 23:59 IST is in.
 */
function orderListWhere(filters: OrderListFilters): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.paymentStatus) {
    params.push(filters.paymentStatus);
    conditions.push(`payment_status = $${params.length}`);
  }
  if (filters.paymentMethod) {
    params.push(filters.paymentMethod);
    conditions.push(`payment_method = $${params.length}`);
  }
  if (filters.isTest !== undefined) {
    params.push(filters.isTest);
    conditions.push(`is_test = $${params.length}`);
  }
  if (filters.placedFrom) {
    params.push(filters.placedFrom);
    conditions.push(`created_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Asia/Kolkata')`);
  }
  if (filters.placedTo) {
    params.push(filters.placedTo);
    conditions.push(
      `created_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata')`,
    );
  }
  if (filters.search) {
    params.push(`%${filters.search.trim()}%`);
    const i = params.length;
    // Email is included because orders now belong to accounts, and the
    // address is what an admin has to hand when a customer writes in.
    conditions.push(
      `(order_number ILIKE $${i} OR customer_phone ILIKE $${i} ` +
        `OR customer_name ILIKE $${i} OR customer_email ILIKE $${i})`,
    );
  }

  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

/**
 * Reservations that still count against stock: active-and-unexpired, or sold
 * and not yet deducted from Hostinger.
 *
 * `reconciled_at` is what stops a sale being subtracted twice. Hostinger has
 * no inventory write API, so a sale here never moves the merchant's own number;
 * once the admin has deducted it by hand in hPanel, that number already
 * accounts for it, and continuing to subtract our consumed reservation would
 * take the same unit off the shelf a second time.
 */
const COMMITTED_RESERVATIONS = `
  ((state = 'consumed' AND reconciled_at IS NULL)
   OR (state = 'active' AND expires_at > now()))`;

/* -------------------------------------------------------- implementation */

/**
 * Group consumed reservations by variant.
 *
 * One order can hold several reservation rows for the same variant; the push
 * needs one job per variant carrying the total, and the ids of exactly the rows
 * that total came from.
 */
function groupByVariant<Row extends { id: string; variant_id: string; quantity: number }>(
  rows: Row[],
): Map<string, Row[]> {
  const grouped = new Map<string, Row[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.variant_id) ?? [];
    bucket.push(row);
    grouped.set(row.variant_id, bucket);
  }
  return grouped;
}

/**
 * The Hostinger product id a variant was sold under.
 *
 * The write endpoint is addressed by product *and* variant, but
 * `stock_reservations` only knows the variant. `order_items` already snapshots
 * both, so the answer is on the order itself and needs no catalogue call —
 * which matters, because this runs inside the payment transaction.
 */
/** Paise refunded on an order in the given refund states, read inside a transaction. */
async function refundedWithin(
  client: PoolClient,
  orderId: number,
  states: RefundStatus[],
): Promise<number> {
  const result = await client.query<{ sum: string }>(
    `SELECT COALESCE(sum(amount), 0)::bigint AS sum FROM order_refunds
      WHERE order_id = $1 AND status = ANY($2::text[])`,
    [orderId, states],
  );
  return Number(result.rows[0]?.sum ?? 0);
}

async function productIdForVariant(
  client: PoolClient,
  orderId: number,
  variantId: string,
): Promise<string | null> {
  const row = await client.query<{ product_id: string }>(
    `SELECT product_id FROM order_items
      WHERE order_id = $1 AND variant_id = $2 LIMIT 1`,
    [orderId, variantId],
  );
  return row.rows[0]?.product_id ?? null;
}

export class PostgresOrderRepository implements OrderRepository, CustomerAwareRepository {
  /**
   * Load items for orders read on a *transaction* client.
   *
   * `hydrate` below runs on the pool, which cannot see rows written inside an
   * open transaction — using it mid-transaction silently returns an order with
   * no items.
   */
  private async hydrateWithin(client: PoolClient, rows: OrderRow[]): Promise<Order[]> {
    if (rows.length === 0) return [];
    const items = await client.query<OrderItemRow>(
      `SELECT * FROM order_items WHERE order_id = ANY($1::bigint[]) ORDER BY id`,
      [rows.map((r) => r.id)],
    );
    const byOrder = new Map<number, OrderItem[]>();
    for (const item of items.rows) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push(toOrderItem(item));
      byOrder.set(item.order_id, list);
    }
    return rows.map((row) => toOrder(row, byOrder.get(row.id) ?? []));
  }

  private async hydrate(rows: OrderRow[]): Promise<Order[]> {
    if (rows.length === 0) return [];
    const items = await query<OrderItemRow>(
      `SELECT * FROM order_items WHERE order_id = ANY($1::bigint[]) ORDER BY id`,
      [rows.map((r) => r.id)],
    );
    const byOrder = new Map<number, OrderItem[]>();
    for (const item of items) {
      const list = byOrder.get(item.order_id) ?? [];
      list.push(toOrderItem(item));
      byOrder.set(item.order_id, list);
    }
    return rows.map((row) => toOrder(row, byOrder.get(row.id) ?? []));
  }

  private async findOneBy(clause: string, params: unknown[]): Promise<Order | null> {
    const row = await queryOne<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE ${clause} LIMIT 1`,
      params,
    );
    if (!row) return null;
    const [order] = await this.hydrate([row]);
    return order ?? null;
  }

  findByOrderNumber(orderNumber: string) {
    return this.findOneBy('order_number = $1', [orderNumber]);
  }

  findById(id: number) {
    return this.findOneBy('id = $1', [id]);
  }

  findByIdempotencyKey(key: string) {
    return this.findOneBy('idempotency_key = $1', [key]);
  }

  /**
   * Find the order a gateway order id belongs to.
   *
   * Checks the current id first, then the attempt history. A capture webhook
   * for an attempt that a retry has since replaced must still find its order —
   * otherwise the customer is charged and the order stays unpaid.
   */
  async findByGatewayOrderId(gatewayOrderId: string) {
    const current = await this.findOneBy('gateway_order_id = $1', [gatewayOrderId]);
    if (current) return current;

    return this.findOneBy(
      'id = (SELECT order_id FROM payment_attempts WHERE gateway_order_id = $1)',
      [gatewayOrderId],
    );
  }

  /**
   * Guest lookup by order number + phone.
   *
   * Constrained to orders with no owner. Once an order belongs to an account,
   * the account is the only way in — otherwise anyone who learned an order
   * number and its phone number could read a stranger's order, and a signed-in
   * customer could reach orders that are not theirs, which is precisely what
   * ownership is supposed to prevent.
   *
   * The `user_id IS NULL` clause is what confines this path to the historical
   * guest orders it exists to serve.
   */
  findForCustomer(orderNumber: string, phone: string) {
    return this.findOneBy('order_number = $1 AND customer_phone = $2 AND user_id IS NULL', [
      orderNumber,
      phone,
    ]);
  }

  /**
   * An order, but only if this account owns it.
   *
   * Ownership is filtered in SQL rather than fetched-then-compared, so there is
   * no window in which a caller holds another customer's order object.
   */
  findForOwner(orderNumber: string, userId: number) {
    return this.findOneBy('order_number = $1 AND user_id = $2', [orderNumber, userId]);
  }

  /** This account's order history, newest first. */
  async listOrdersForUser(userId: number, limit = 50, offset = 0) {
    const capped = Math.min(limit, 200);

    const totalRow = await queryOne<{ count: number }>(
      `SELECT count(*)::bigint AS count FROM orders WHERE user_id = $1`,
      [userId],
    );

    const rows = await query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE user_id = $1
        ORDER BY created_at DESC LIMIT ${capped} OFFSET ${Math.max(0, Math.floor(offset))}`,
      [userId],
    );

    return { orders: await this.hydrate(rows), total: totalRow?.count ?? 0 };
  }

  async listOrders(filters: OrderListFilters) {
    const { where, params } = orderListWhere(filters);
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;
    const direction = filters.direction === 'asc' ? 'ASC' : 'DESC';
    const column = ORDER_SORT_COLUMNS[filters.sort ?? 'placed'] ?? 'created_at';

    // Two independent reads against the same snapshot — the admin console paid
    // for both round trips in series on every page view and every pagination
    // click.
    const [totalRow, rows] = await Promise.all([
      queryOne<{ count: number }>(
        `SELECT count(*)::bigint AS count FROM orders ${where}`,
        params,
      ),
      // `id` breaks ties, so paging through equal totals or names never shows
      // a row twice or skips one.
      query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders ${where}
          ORDER BY ${column} ${direction}, id ${direction} LIMIT ${limit} OFFSET ${offset}`,
        params,
      ),
    ]);

    return { orders: await this.hydrate(rows), total: totalRow?.count ?? 0 };
  }

  async countByStatus(filters: OrderListFilters) {
    const { where, params } = orderListWhere({ ...filters, status: undefined });
    const rows = await query<{ status: OrderStatus; count: number }>(
      `SELECT status, count(*)::int AS count FROM orders ${where} GROUP BY status`,
      params,
    );
    const counts: Record<OrderStatus, number> = {
      pending_payment: 0,
      confirmed: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const row of rows) counts[row.status] = Number(row.count);
    return counts;
  }

  /* ------------------------------------------------------ order creation */

  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const { order, reservations, availableByVariant, reservationTtlMinutes } = input;

    // Fast path outside the transaction: a repeated submit is common and does
    // not deserve a write lock.
    if (order.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(order.idempotencyKey);
      if (existing) return { ok: true, order: existing, reused: true };
    }

    return transaction(async (client) => {
      if (order.idempotencyKey) {
        const again = await client.query<OrderRow>(
          `SELECT ${ORDER_COLUMNS} FROM orders WHERE idempotency_key = $1 LIMIT 1`,
          [order.idempotencyKey],
        );
        if (again.rows[0]) {
          const [hydrated] = await this.hydrateWithin(client, again.rows);
          return { ok: true, order: hydrated, reused: true } as CreateOrderResult;
        }
      }

      const variantIds = [...new Set(reservations.map((r) => r.variantId))].sort();

      if (variantIds.length > 0) {
        // Ensure a lockable row exists for every variant, seeded from the live
        // catalogue read, then lock them in a stable order to avoid deadlocks.
        for (const variantId of variantIds) {
          await client.query(
            `INSERT INTO inventory_baseline (variant_id, hostinger_quantity)
             VALUES ($1, $2)
             ON CONFLICT (variant_id) DO NOTHING`,
            [variantId, Math.max(0, availableByVariant[variantId] ?? 0)],
          );
        }

        const locked = await client.query<{ variant_id: string; hostinger_quantity: number }>(
          `SELECT variant_id, hostinger_quantity
             FROM inventory_baseline
            WHERE variant_id = ANY($1::text[])
            ORDER BY variant_id
              FOR UPDATE`,
          [variantIds],
        );
        const baseline = new Map(locked.rows.map((r) => [r.variant_id, r.hostinger_quantity]));

        const committed = await client.query<{ variant_id: string; reserved: number }>(
          `SELECT variant_id, COALESCE(sum(quantity), 0)::bigint AS reserved
             FROM stock_reservations
            WHERE variant_id = ANY($1::text[]) AND ${COMMITTED_RESERVATIONS}
            GROUP BY variant_id`,
          [variantIds],
        );
        const reserved = new Map(committed.rows.map((r) => [r.variant_id, r.reserved]));

        for (const request of reservations) {
          // If the merchant reduced stock in hPanel since our last sync, the
          // live figure is lower than the baseline — take the smaller of the
          // two so the order fails safe rather than overselling.
          const live = availableByVariant[request.variantId];
          const stored = baseline.get(request.variantId) ?? 0;
          const effective = live === undefined ? stored : Math.min(stored, live);
          const available = effective - (reserved.get(request.variantId) ?? 0);

          if (request.quantity > available) {
            // Returning rather than throwing keeps this an expected outcome the
            // checkout can explain, not an error page.
            throw new InsufficientStock(request.variantId, Math.max(0, available));
          }
        }
      }

      /* ---------------------------------------------------- insert order */

      let orderNumber = order.orderNumber || generateOrderNumber();
      let inserted: OrderRow | undefined;

      // The unique index is the guarantee; retry on the vanishingly rare clash.
      //
      // Each attempt runs inside a SAVEPOINT. In PostgreSQL a failed statement
      // aborts the whole transaction, so without one the retry would hit
      // `25P02 current transaction is aborted` and the recovery path would be
      // dead code — which it was. Rolling back to the savepoint puts the
      // transaction back into a usable state so the next INSERT can run.
      for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
        const savepoint = `order_insert_${attempt}`;
        await client.query(`SAVEPOINT ${savepoint}`);
        try {
          const result = await client.query<OrderRow>(
            `INSERT INTO orders (
               order_number, user_id, status, payment_status,
               customer_name, customer_phone, customer_email, shipping_address,
               subtotal, product_savings, coupon_code, coupon_discount, shipping, cod_fee,
               total, gst_amount, gst_rate, place_of_supply, buyer_gstin, seller_gstin,
               payment_method, is_test, idempotency_key, gateway_order_id, payment_discount,
               terms_accepted_at, placed_by
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,
               CASE WHEN $26 THEN now() END, $27
             ) RETURNING ${ORDER_COLUMNS}`,
            [
              orderNumber,
              order.userId ?? null,
              order.status,
              order.paymentStatus,
              order.contact.name,
              order.contact.phone,
              order.contact.email ?? null,
              JSON.stringify(order.shippingAddress),
              order.amounts.subtotal,
              order.amounts.productSavings,
              order.amounts.couponCode ?? null,
              order.amounts.couponDiscount,
              order.amounts.shipping,
              order.amounts.codFee,
              order.amounts.total,
              order.amounts.gstAmount,
              order.amounts.gstRate,
              order.placeOfSupply ?? null,
              order.buyerGstin ?? null,
              order.sellerGstin ?? null,
              order.paymentMethod,
              order.isTest,
              order.idempotencyKey ?? null,
              order.gatewayOrderId ?? null,
              order.amounts.paymentDiscount,
              order.termsAccepted === true,
              order.placedBy ?? null,
            ],
          );
          inserted = result.rows[0];
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);

          if (isUniqueViolation(error, 'orders_order_number_key')) {
            orderNumber = generateOrderNumber();
            continue;
          }

          // Two simultaneous submits of the same idempotency key: the earlier
          // SELECT missed because the other transaction had not committed yet,
          // and this INSERT lost the race. The caller asked for "this order,
          // once" and that is exactly what exists now, so return it rather
          // than surfacing a 500 for what is a successful outcome.
          if (order.idempotencyKey && isUniqueViolation(error, 'orders_idempotency_key_key')) {
            throw new IdempotencyRace(order.idempotencyKey);
          }

          throw error;
        }
      }

      if (!inserted) throw new Error('Could not allocate a unique order number.');

      for (const item of order.items) {
        await client.query(
          `INSERT INTO order_items (
             order_id, product_id, variant_id, sku, title, variant_title, image,
             unit_mrp, unit_price, quantity, line_total, hsn_code, tax_rate,
             installation_included
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            inserted.id,
            item.productId,
            item.variantId,
            item.sku,
            item.title,
            item.variantTitle ?? null,
            item.image ?? null,
            item.unitMrp,
            item.unitPrice,
            item.quantity,
            item.lineTotal,
            item.hsnCode ?? null,
            item.taxRate,
            item.installationIncluded,
          ],
        );
      }

      for (const request of reservations) {
        await client.query(
          `INSERT INTO stock_reservations (variant_id, order_id, quantity, state, expires_at)
           VALUES ($1, $2, $3, 'active', now() + ($4 || ' minutes')::interval)`,
          [request.variantId, inserted.id, request.quantity, String(reservationTtlMinutes)],
        );
      }

      await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, actor, note)
         VALUES ($1, NULL, $2, 'system', 'Order created')`,
        [inserted.id, order.status],
      );

      // Cash on delivery is created already confirmed: date that stage now.
      if (order.status === 'confirmed') {
        await client.query('UPDATE orders SET confirmed_at = now() WHERE id = $1', [inserted.id]);
        inserted.confirmed_at = new Date();
      }

      // In the same transaction as the order, so a rollback cannot leave a
      // redemption recorded against an order that does not exist. The table
      // has existed since the first migration and nothing ever wrote to it,
      // which is why per-customer coupon limits were unenforceable.
      if (order.amounts.couponCode) {
        const limits = input.couponLimits;
        if (limits && (limits.maxTotal !== null || limits.maxPerCustomer !== null)) {
          // One checkout per code at a time past this point, so two orders
          // cannot both count 0 of 1 uses and both take it. Released at commit.
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            `coupon:${order.amounts.couponCode.toUpperCase()}`,
          ]);
          const used = await countRedemptions(
            order.amounts.couponCode,
            { userId: limits.userId, phone: order.contact.phone },
            client,
          );
          if (
            (limits.maxTotal !== null && used.total >= limits.maxTotal) ||
            (limits.maxPerCustomer !== null && used.customer >= limits.maxPerCustomer)
          ) {
            throw new CouponLimitReached();
          }
        }
        await client.query(
          `INSERT INTO coupon_redemptions (order_id, code, phone, user_id) VALUES ($1, $2, $3, $4)`,
          [inserted.id, order.amounts.couponCode, order.contact.phone, input.couponLimits?.userId ?? null],
        );
      }

      const [hydrated] = await this.hydrateWithin(client, [inserted]);
      return { ok: true, order: hydrated, reused: false } as CreateOrderResult;
    }).catch(async (error: unknown) => {
      if (error instanceof IdempotencyRace) {
        // Resolved outside the aborted transaction: the winning row was
        // committed by another connection and is only visible from a fresh
        // snapshot.
        const existing = await this.findByIdempotencyKey(error.key);
        if (existing) {
          return { ok: true, order: existing, reused: true } satisfies CreateOrderResult;
        }
        throw error;
      }

      if (error instanceof CouponLimitReached) {
        return { ok: false, reason: 'coupon_limit' } satisfies CreateOrderResult;
      }

      if (error instanceof InsufficientStock) {
        return {
          ok: false,
          reason: 'insufficient_stock',
          variantId: error.variantId,
          available: error.available,
        } satisfies CreateOrderResult;
      }
      throw error;
    });
  }

  /**
   * Point the order at a gateway order, recording the attempt.
   *
   * `orders.gateway_order_id` still holds the newest attempt, because that is
   * what the callback verifies against. The history in `payment_attempts` is
   * what stops an earlier attempt's webhook from becoming unmatched when a
   * retry replaces it.
   */
  async setGatewayOrderId(orderId: number, gatewayOrderId: string, provider = 'unknown') {
    await transaction(async (client) => {
      const current = await client.query<{ gateway_order_id: string | null; total: number }>(
        `SELECT gateway_order_id, total FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      );
      const row = current.rows[0];
      if (!row) return;

      if (row.gateway_order_id && row.gateway_order_id !== gatewayOrderId) {
        await client.query(
          `UPDATE payment_attempts SET superseded_at = now()
            WHERE order_id = $1 AND superseded_at IS NULL`,
          [orderId],
        );
      }

      await client.query(
        `INSERT INTO payment_attempts (order_id, provider, gateway_order_id, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (gateway_order_id) DO NOTHING`,
        [orderId, provider, gatewayOrderId, row.total],
      );

      await client.query(`UPDATE orders SET gateway_order_id = $2 WHERE id = $1`, [
        orderId,
        gatewayOrderId,
      ]);
    });
  }

  /** Every gateway order ever created for this order, newest first. */
  async listPaymentAttempts(orderId: number): Promise<
    Array<{ gatewayOrderId: string; provider: string; amount: number; supersededAt: string | null }>
  > {
    const rows = await query<{
      gateway_order_id: string;
      provider: string;
      amount: number;
      superseded_at: Date | null;
    }>(
      `SELECT gateway_order_id, provider, amount, superseded_at
         FROM payment_attempts WHERE order_id = $1 ORDER BY created_at DESC`,
      [orderId],
    );
    return rows.map((r) => ({
      gatewayOrderId: r.gateway_order_id,
      provider: r.provider,
      amount: r.amount,
      supersededAt: r.superseded_at?.toISOString() ?? null,
    }));
  }

  /* ---------------------------------------------------------- payments */

  /**
   * Record a payment, once per gateway payment id.
   *
   * `authoritative` marks a caller that heard the figures from the gateway
   * itself — the webhook. The browser callback does not: it is told only that
   * a payment succeeded, so it writes *our* order total as the amount, which
   * is a reasonable guess and not evidence.
   *
   * Because the callback usually lands first and the insert ignored conflicts,
   * that guess used to win permanently and the gateway's real figure was
   * discarded. An authoritative writer may now correct `amount` and `method`
   * on the existing row. It deliberately does **not** touch `status`: payment
   * state transitions are ordered and validated by `applyPaymentStatus`, and
   * letting a late webhook rewrite status here would bypass that.
   */
  async recordPayment(
    payment: Omit<PaymentRecord, 'id' | 'createdAt'>,
    options: { authoritative?: boolean } = {},
  ): Promise<boolean> {
    const onConflict = options.authoritative
      ? `DO UPDATE SET amount = EXCLUDED.amount,
                       method = COALESCE(EXCLUDED.method, payments.method)`
      : 'DO NOTHING';

    const rows = await query<{ id: number }>(
      `INSERT INTO payments (
         order_id, provider, gateway_payment_id, status, amount, method,
         signature_verified, error_code, error_description
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (provider, gateway_payment_id) ${onConflict}
       RETURNING id`,
      [
        payment.orderId,
        payment.provider,
        payment.gatewayPaymentId,
        payment.status,
        payment.amount,
        payment.method ?? null,
        payment.signatureVerified,
        payment.errorCode ?? null,
        payment.errorDescription ?? null,
      ],
    );
    return rows.length > 0;
  }

  async listPayments(orderId: number): Promise<PaymentRecord[]> {
    const rows = await query<{
      id: number;
      order_id: number;
      provider: string;
      gateway_payment_id: string;
      status: PaymentStatus;
      amount: number;
      method: string | null;
      signature_verified: boolean;
      error_code: string | null;
      error_description: string | null;
      created_at: Date;
    }>(`SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at`, [orderId]);

    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      gatewayPaymentId: row.gateway_payment_id,
      status: row.status,
      amount: row.amount,
      method: row.method ?? undefined,
      signatureVerified: row.signature_verified,
      errorCode: row.error_code ?? undefined,
      errorDescription: row.error_description ?? undefined,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /**
   * Apply a payment outcome, ignoring anything that would move it backwards.
   *
   * This is what makes duplicated and out-of-order webhooks safe: a late
   * `authorized` arriving after `captured` is a no-op rather than a regression.
   */
  async applyPaymentStatus(
    orderId: number,
    status: PaymentStatus,
    actor: string,
    note?: string,
  ): Promise<Order | null> {
    /**
     * Whether this call actually moved a catalogue quantity.
     *
     * Set inside the transaction and acted on after it commits — purging the
     * cache while the new number is still uncommitted would let a read racing
     * the purge repopulate it with the old one.
     */
    let stockChanged = false;

    /**
     * Whether a variant crossed to zero during this capture.
     *
     * Same pattern as `stockChanged` and for a sharper reason: the alert is an
     * SMTP round trip, and doing it inside the payment transaction would make a
     * mail-server timeout roll back a payment Razorpay has already taken.
     */
    let stockTransitionRecorded = false;

    /**
     * Whether this call is the one that moved the payment to `paid`.
     *
     * The webhook and the browser callback both arrive for one payment; the row
     * lock makes exactly one of them see the old status, so only that one sends
     * the confirmation mail (R-03). Sent after commit, for the reason above.
     */
    let newlyPaid = false;

    const result = await transaction(async (client) => {
      const current = await client.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      );
      const row = current.rows[0];
      if (!row) return null;

      // Two gates, and they answer different questions.
      //
      // `isPaymentAdvance` is about *ordering*: webhooks arrive late and out of
      // sequence, and a stale `authorized` after a `captured` must change
      // nothing. Rank alone was the only check here, which meant the declared
      // PAYMENT_TRANSITIONS table was never consulted at runtime — it would
      // happily have accepted pending → refunded, a transition the table
      // forbids.
      //
      // `canTransitionPayment` is about *legality*: which moves the model
      // permits at all. Both must agree before anything is written.
      if (
        !isPaymentAdvance(row.payment_status, status) ||
        !canTransitionPayment(row.payment_status, status)
      ) {
        const [unchanged] = await this.hydrateWithin(client, [row]);
        return unchanged;
      }

      const nextOrderStatus = orderStatusForPayment(status, row.status);

      const stamps =
        (status === 'paid' ? ', paid_at = COALESCE(paid_at, now())' : '') +
        (nextOrderStatus !== row.status ? stampStage(nextOrderStatus) : '');
      const updated = await client.query<OrderRow>(
        `UPDATE orders SET payment_status = $2, status = $3${stamps} WHERE id = $1
         RETURNING ${ORDER_COLUMNS}`,
        [orderId, status, nextOrderStatus],
      );

      await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, actor, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, `payment:${row.payment_status}`, `payment:${status}`, actor, note ?? null],
      );

      if (nextOrderStatus !== row.status) {
        await client.query(
          `INSERT INTO order_events (order_id, from_status, to_status, actor, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, row.status, nextOrderStatus, actor, 'Payment received'],
        );
      }

      // Paid means the stock is genuinely gone; abandoned reservations are
      // released by the TTL instead.
      if (status === 'paid') {
        newlyPaid = row.payment_status !== 'paid';
        const effect = await this.consumeWithin(client, orderId);
        stockChanged = effect.stockChanged;
        stockTransitionRecorded = effect.transitionRecorded;
      }

      const [hydrated] = await this.hydrateWithin(client, updated.rows);
      return hydrated;
    });

    afterStockChange(stockChanged, stockTransitionRecorded);
    if (newlyPaid && result) notifyOrderPaidInBackground(result);

    return result;
  }

  async transitionOrderStatus(
    orderId: number,
    to: OrderStatus,
    actor: string,
    note?: string,
    options: { customerVisible?: boolean; shipment?: Shipment } = {},
  ): Promise<Order | null> {
    // Acted on after the commit, as in `applyPaymentStatus`.
    let restock = { stockChanged: false, transitionRecorded: false };

    const result = await transaction(async (client) => {
      const current = await client.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      );
      const row = current.rows[0];
      if (!row) return null;

      // Validated here, not only in the admin action that calls it. The
      // repository is the last place before the write, and a caller that
      // forgets to check must not be able to put an order into a state the
      // model says is impossible — `shipped → cancelled`, say, or anything
      // out of a terminal state.
      if (!canTransitionOrder(row.status, to)) {
        const [unchanged] = await this.hydrateWithin(client, [row]);
        return unchanged;
      }

      const updated = await client.query<OrderRow>(
        `UPDATE orders SET status = $2${stampStage(to)} WHERE id = $1 RETURNING ${ORDER_COLUMNS}`,
        [orderId, to],
      );

      await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, actor, note, customer_visible)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, row.status, to, actor, note ?? null, options.customerVisible ?? true],
      );

      if (options.shipment) {
        const withShipment = await this.writeShipmentWithin(client, orderId, options.shipment);
        if (withShipment) updated.rows[0] = withShipment;
      }

      if (to === 'cancelled') {
        // Units held for an unpaid order go back to the pool; units already
        // sold — cash on delivery, or a captured payment — go back on the shelf.
        await this.releaseWithin(client, orderId);
        restock = await this.restockWithin(client, orderId);
      }

      const [hydrated] = await this.hydrateWithin(client, updated.rows);
      return hydrated;
    });

    afterStockChange(restock.stockChanged, restock.transitionRecorded);
    return result;
  }

  /**
   * Record something that happened to an order without changing its status —
   * a customer told about a delay, say. Stored as an event from a status to
   * the same status, so the order history shows it in sequence with the rest.
   */
  async addOrderNote(
    orderId: number,
    actor: string,
    note: string,
    customerVisible = true,
  ): Promise<void> {
    await query(
      `INSERT INTO order_events (order_id, from_status, to_status, actor, note, customer_visible)
       SELECT id, status, status, $2, $3, $4 FROM orders WHERE id = $1`,
      [orderId, actor, note, customerVisible],
    );
  }

  /* ------------------------------------------------------- refunds (R-12) */

  /**
   * Reserve a refund against an order, refusing anything over what was paid.
   *
   * The cap (D-08: "never more than the amount paid on that order") is checked
   * under the order's row lock and counts pending refunds as well as processed
   * ones. Two admins pressing Refund at once therefore cannot both pass: the
   * second waits for the first's row and then sees it in the sum. A refund the
   * gateway refused is marked `failed` and stops counting.
   *
   * The row is written before the gateway is called, so a refund Razorpay
   * accepted is never left without a record of who asked for it.
   */
  async beginRefund(input: {
    orderId: number;
    amount: number;
    reason: string;
    requestedBy: string;
    provider: string;
    gatewayPaymentId: string;
  }): Promise<
    | { ok: true; refundId: number }
    | { ok: false; reason: 'not_paid' | 'exceeds_paid'; refundable: number }
  > {
    return transaction(async (client) => {
      const order = await client.query<{ payment_status: PaymentStatus; total: number }>(
        `SELECT payment_status, total FROM orders WHERE id = $1 FOR UPDATE`,
        [input.orderId],
      );
      const row = order.rows[0];
      if (!row || row.payment_status !== 'paid') {
        return { ok: false as const, reason: 'not_paid' as const, refundable: 0 };
      }

      const refundable = row.total - (await refundedWithin(client, input.orderId, ['pending', 'processed']));
      if (input.amount > refundable) {
        return { ok: false as const, reason: 'exceeds_paid' as const, refundable: Math.max(0, refundable) };
      }

      const inserted = await client.query<{ id: number }>(
        `INSERT INTO order_refunds (order_id, provider, gateway_payment_id, amount, reason, requested_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [input.orderId, input.provider, input.gatewayPaymentId, input.amount, input.reason, input.requestedBy],
      );
      return { ok: true as const, refundId: inserted.rows[0]!.id };
    });
  }

  /** What the gateway said when the refund was requested. */
  async recordRefundResponse(
    refundId: number,
    outcome: { gatewayRefundId?: string; status: RefundStatus; error?: string },
  ): Promise<void> {
    await query(
      `UPDATE order_refunds
          SET gateway_refund_id = COALESCE($2, gateway_refund_id),
              status = $3,
              error = $4,
              processed_at = CASE WHEN $3 = 'processed' THEN COALESCE(processed_at, now()) END
        WHERE id = $1`,
      [refundId, outcome.gatewayRefundId ?? null, outcome.status, outcome.error ?? null],
    );
  }

  /**
   * Settle a refund the gateway has finished, from its webhook or its answer.
   *
   * Matched on the gateway's refund id. A refund made in the Razorpay dashboard
   * rather than from our order page has no row yet; it is recorded here with
   * `requested_by = 'gateway dashboard'`, so the order still shows the money
   * going back. Returns whether the order is now refunded in full — that, not
   * any single refund, is what moves the payment to `refunded`. A partial
   * refund leaves it `paid`.
   */
  async settleRefund(input: {
    orderId: number;
    provider: string;
    gatewayRefundId: string;
    gatewayPaymentId?: string;
    amount?: number;
    status: 'processed' | 'failed';
    error?: string;
  }): Promise<{ fullyRefunded: boolean }> {
    return transaction(async (client) => {
      const order = await client.query<{ total: number }>(
        `SELECT total FROM orders WHERE id = $1 FOR UPDATE`,
        [input.orderId],
      );
      const total = order.rows[0]?.total ?? 0;

      const updated = await client.query(
        `UPDATE order_refunds
            SET status = $3, error = $4,
                processed_at = CASE WHEN $3 = 'processed' THEN COALESCE(processed_at, now()) END
          WHERE provider = $1 AND gateway_refund_id = $2 AND status <> 'processed'
          RETURNING id`,
        [input.provider, input.gatewayRefundId, input.status, input.error ?? null],
      );

      if (
        updated.rowCount === 0 &&
        input.status === 'processed' &&
        input.amount &&
        input.gatewayPaymentId
      ) {
        await client.query(
          `INSERT INTO order_refunds (order_id, provider, gateway_payment_id, gateway_refund_id,
                                      amount, status, reason, requested_by, processed_at)
           VALUES ($1, $2, $3, $4, $5, 'processed', 'Refunded in the gateway dashboard',
                   'gateway dashboard', now())
           ON CONFLICT (provider, gateway_refund_id) DO NOTHING`,
          [input.orderId, input.provider, input.gatewayPaymentId, input.gatewayRefundId, input.amount],
        );
      }

      const processed = await refundedWithin(client, input.orderId, ['processed']);
      return { fullyRefunded: total > 0 && processed >= total };
    });
  }

  async listRefunds(orderId: number): Promise<RefundRecord[]> {
    const rows = await query<{
      id: number;
      order_id: number;
      provider: string;
      gateway_payment_id: string;
      gateway_refund_id: string | null;
      amount: string;
      status: RefundStatus;
      reason: string;
      requested_by: string;
      error: string | null;
      created_at: Date;
      processed_at: Date | null;
    }>(`SELECT * FROM order_refunds WHERE order_id = $1 ORDER BY created_at`, [orderId]);

    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      provider: row.provider,
      gatewayPaymentId: row.gateway_payment_id,
      gatewayRefundId: row.gateway_refund_id ?? undefined,
      // bigint arrives as a string from `pg`.
      amount: Number(row.amount),
      status: row.status,
      reason: row.reason,
      requestedBy: row.requested_by,
      error: row.error ?? undefined,
      createdAt: row.created_at.toISOString(),
      processedAt: row.processed_at?.toISOString(),
    }));
  }

  /**
   * The customer's "Request cancellation" (R-12).
   *
   * Only before dispatch, and only once: a second press changes nothing and
   * returns null, so the team is not alerted twice. Nothing is cancelled here —
   * an admin cancels and refunds from the order page.
   */
  async requestCancellation(orderId: number, note?: string): Promise<Order | null> {
    return transaction(async (client) => {
      const updated = await client.query<OrderRow>(
        `UPDATE orders SET cancellation_requested_at = now(), cancellation_request_note = $2
          WHERE id = $1 AND cancellation_requested_at IS NULL
            AND status IN ('confirmed', 'packed')
          RETURNING ${ORDER_COLUMNS}`,
        [orderId, note ?? null],
      );
      const row = updated.rows[0];
      if (!row) return null;

      await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, actor, note)
         VALUES ($1, $2, $2, 'customer', $3)`,
        [orderId, row.status, `Cancellation requested${note ? `: ${note}` : ''}`],
      );
      const [hydrated] = await this.hydrateWithin(client, [row]);
      return hydrated;
    });
  }

  /* ------------------------------------------------- payment links (R-18) */

  /** The order a recorded payment belongs to — how a refund webhook without an order id is matched. */
  findByGatewayPaymentId(gatewayPaymentId: string) {
    return this.findOneBy(
      'id = (SELECT order_id FROM payments WHERE gateway_payment_id = $1 LIMIT 1)',
      [gatewayPaymentId],
    );
  }

  findByPaymentLinkId(paymentLinkId: string) {
    return this.findOneBy('payment_link_id = $1', [paymentLinkId]);
  }

  async setPaymentLink(orderId: number, link: { id: string; url: string }, actor: string): Promise<void> {
    await query(`UPDATE orders SET payment_link_id = $2, payment_link_url = $3 WHERE id = $1`, [
      orderId,
      link.id,
      link.url,
    ]);
    await this.addOrderNote(orderId, actor, 'Payment link sent to the customer', false);
  }

  /**
   * Courier and delivery details. Blank fields clear. Recorded in the history
   * so the customer's tracking page shows when they were added.
   */
  async updateShipment(orderId: number, shipment: Shipment, actor: string): Promise<Order | null> {
    return transaction(async (client) => {
      const row = await this.writeShipmentWithin(client, orderId, shipment);
      if (!row) return null;
      await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, actor, note)
         VALUES ($1, $2, $2, $3, 'Shipping details updated')`,
        [orderId, row.status, actor],
      );
      const [hydrated] = await this.hydrateWithin(client, [row]);
      return hydrated ?? null;
    });
  }

  private async writeShipmentWithin(
    client: PoolClient,
    orderId: number,
    shipment: Shipment,
  ): Promise<OrderRow | null> {
    const result = await client.query<OrderRow>(
      `UPDATE orders
          SET courier_name = $2, tracking_number = $3, tracking_url = $4,
              delivery_person = $5, delivery_phone = $6
        WHERE id = $1
        RETURNING ${ORDER_COLUMNS}`,
      [
        orderId,
        shipment.courierName ?? null,
        shipment.trackingNumber ?? null,
        shipment.trackingUrl ?? null,
        shipment.deliveryPerson ?? null,
        shipment.deliveryPhone ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async listEvents(orderId: number): Promise<OrderEvent[]> {
    const rows = await query<{
      id: number;
      order_id: number;
      from_status: string | null;
      to_status: string;
      actor: string;
      note: string | null;
      customer_visible: boolean;
      created_at: Date;
    }>(`SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at, id`, [orderId]);

    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actor: row.actor,
      note: row.note ?? undefined,
      customerVisible: row.customer_visible,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /** False when this event has already been recorded — the replay guard. */
  /**
   * Claim a webhook event for processing.
   *
   * Returns false when this event id has already been claimed, which is what
   * makes a redelivery a no-op. `processed_at` is deliberately left NULL: it is
   * stamped by `completeWebhookEvent` once the event has actually been applied.
   *
   * The previous version stamped it here, at insert. That made the window
   * between "recorded" and "applied" fatal — a database blip in between meant
   * the gateway's retry was rejected as a duplicate and the payment update was
   * lost with nothing left to find it by.
   */
  async beginWebhookEvent(
    provider: string,
    eventId: string,
    eventType: string,
    payload: unknown,
  ): Promise<boolean> {
    const rows = await query<{ id: number }>(
      `INSERT INTO webhook_events (provider, event_id, event_type, payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [provider, eventId, eventType, JSON.stringify(payload)],
    );
    return rows.length > 0;
  }

  /** Mark an event finished. Only now is a redelivery genuinely redundant. */
  async completeWebhookEvent(provider: string, eventId: string): Promise<void> {
    await query(
      `UPDATE webhook_events SET processed_at = now()
        WHERE provider = $1 AND event_id = $2 AND processed_at IS NULL`,
      [provider, eventId],
    );
  }

  /**
   * Release a claim so the gateway's next retry is allowed through.
   *
   * Used when applying the event failed. Without this the row would sit there
   * claimed-but-unapplied, and every retry would be turned away as a duplicate.
   */
  async abandonWebhookEvent(provider: string, eventId: string): Promise<void> {
    await query(
      `DELETE FROM webhook_events
        WHERE provider = $1 AND event_id = $2 AND processed_at IS NULL`,
      [provider, eventId],
    );
  }

  /** Events claimed but never completed — the dead-letter queue. */
  async unprocessedWebhookEvents(olderThanMinutes = 5): Promise<
    Array<{ id: number; provider: string; eventId: string; eventType: string; receivedAt: string }>
  > {
    const rows = await query<{
      id: number;
      provider: string;
      event_id: string;
      event_type: string;
      received_at: Date;
    }>(
      `SELECT id, provider, event_id, event_type, received_at
         FROM webhook_events
        WHERE processed_at IS NULL
          AND received_at < now() - ($1 || ' minutes')::interval
        ORDER BY received_at`,
      [olderThanMinutes],
    );
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      eventId: r.event_id,
      eventType: r.event_type,
      receivedAt: r.received_at.toISOString(),
    }));
  }

  /* ----------------------------------------------------------- coupons */

  /**
   * Has this customer already redeemed this code?
   *
   * Keyed on phone because that is what `coupon_redemptions` records and what
   * its index covers. A customer who changes their number could redeem a
   * single-use code again; tying it to `user_id` would be tighter, and is the
   * obvious next step if these ever carry real money.
   */
  async hasRedeemedCoupon(code: string, phone: string): Promise<boolean> {
    const row = await queryOne<{ exists: boolean }>(
      `SELECT true AS exists FROM coupon_redemptions
        WHERE upper(code) = upper($1) AND phone = $2 LIMIT 1`,
      [code, phone],
    );
    return Boolean(row);
  }

  /* --------------------------------------------------------- inventory */

  async syncInventoryBaseline(entries: Array<{ variantId: string; quantity: number }>) {
    for (const entry of entries) {
      await query(
        `INSERT INTO inventory_baseline (variant_id, hostinger_quantity, synced_at)
         VALUES ($1, $2, now())
         ON CONFLICT (variant_id)
         DO UPDATE SET hostinger_quantity = EXCLUDED.hostinger_quantity, synced_at = now()`,
        [entry.variantId, Math.max(0, entry.quantity)],
      );
    }
  }

  async availability(variantIds: string[]): Promise<Record<string, number>> {
    if (variantIds.length === 0) return {};
    const rows = await query<{ variant_id: string; available: number }>(
      `SELECT b.variant_id,
              GREATEST(b.hostinger_quantity - COALESCE(r.reserved, 0), 0)::bigint AS available
         FROM inventory_baseline b
         LEFT JOIN (
              SELECT variant_id, sum(quantity) AS reserved
                FROM stock_reservations
               WHERE ${COMMITTED_RESERVATIONS}
               GROUP BY variant_id
         ) r ON r.variant_id = b.variant_id
        WHERE b.variant_id = ANY($1::text[])`,
      [variantIds],
    );
    return Object.fromEntries(rows.map((row) => [row.variant_id, row.available]));
  }

  async listReservations(orderId: number): Promise<StockReservation[]> {
    const rows = await query<{
      id: number;
      variant_id: string;
      order_id: number | null;
      quantity: number;
      state: StockReservation['state'];
      expires_at: Date;
      created_at: Date;
    }>(`SELECT * FROM stock_reservations WHERE order_id = $1 ORDER BY id`, [orderId]);

    return rows.map((row) => ({
      id: row.id,
      variantId: row.variant_id,
      orderId: row.order_id,
      quantity: row.quantity,
      state: row.state,
      expiresAt: row.expires_at.toISOString(),
      createdAt: row.created_at.toISOString(),
    }));
  }

  /**
   * The order's units are sold: take them off the shelf.
   *
   * Cash on delivery calls this at placement — the order is confirmed with no
   * payment step to wait for. It used to flip the reservations to `consumed`
   * and stop there, so `product_variants.stock` never moved: a product sold
   * out by COD orders went on showing "In stock" on its page while checkout
   * refused it. It now takes exactly the path a captured online payment takes.
   */
  async consumeReservations(orderId: number) {
    const effect = await transaction((client) => this.consumeWithin(client, orderId));
    afterStockChange(effect.stockChanged, effect.transitionRecorded);
  }

  /**
   * Consume an order's active reservations and deduct them from our catalogue,
   * inside the caller's transaction. Shared by a captured payment and a cash on
   * delivery order, so both sell stock the same way.
   *
   * Returns what changed, for `afterStockChange` to act on once the caller's
   * transaction has committed.
   */
  private async consumeWithin(
    client: PoolClient,
    orderId: number,
  ): Promise<{ stockChanged: boolean; transitionRecorded: boolean }> {
    let stockChanged = false;
    let transitionRecorded = false;

    const consumed = await client.query<{ id: string; variant_id: string; quantity: number }>(
      `UPDATE stock_reservations SET state = 'consumed'
        WHERE order_id = $1 AND state = 'active'
        RETURNING id, variant_id, quantity`,
      [orderId],
    );

    // `RETURNING` above is what makes each branch below settle exactly the
    // rows it counted, rather than re-reading by (variant, state) and
    // sweeping up later sales.
    for (const [variantId, rows] of groupByVariant(consumed.rows)) {
      const units = rows.reduce((sum, row) => sum + row.quantity, 0);

      /**
       * Our own catalogue is deducted here, and this is the whole fix.
       *
       * Consuming the reservation used to be the end of it: the row moved
       * to `consumed` and `product_variants.stock` never changed. The
       * effective figure the order path computes — baseline minus committed
       * reservations — did fall, so overselling was already impossible, but
       * the number the product page, the product card and the admin table
       * all read is the *column*, and the column still said what it said
       * before the sale. A unit could be paid for and the catalogue would
       * go on advertising it.
       *
       * The join is also the eligibility check. A variant id that does not
       * resolve to a row here is not ours — a Hostinger product, a demo
       * fixture, an id from an older provider — and falls through to the
       * outbox below untouched. There is no second product list to keep.
       *
       * `FOR UPDATE` serialises two captures of the same variant, and all
       * of it is inside the payment transaction, so the deduction commits
       * with the payment or not at all.
       */
      const owned = await client.query<{
        id: number;
        stock: number | null;
        sku: string;
        product_key: string;
      }>(
        `SELECT v.id, v.stock, v.sku, p.product_key
           FROM product_variants v
           JOIN products p ON p.id = v.product_id
          WHERE p.product_key || ':' || v.variant_key = $1
          FOR UPDATE OF v`,
        [variantId],
      );

      if (owned.rows.length > 0) {
        const variant = owned.rows[0]!;

        // `stock IS NULL` means "not counted", which is not the same as
        // zero — `0012_product_catalogue.sql` says so in as many words. An
        // untracked variant stays untracked; there is no number to move.
        if (variant.stock !== null) {
          // `GREATEST(…, 0)` cannot normally fire: a reservation exists
          // only because the order path found the units available. It is
          // here because the alternative is worse — the column carries a
          // `stock >= 0` CHECK, and letting that raise would roll back a
          // payment already taken, over an inventory discrepancy.
          const after = await client.query<{ stock: number }>(
            `UPDATE product_variants
                SET stock = GREATEST(stock - $2, 0)
              WHERE id = $1
              RETURNING stock`,
            [variant.id, units],
          );

          if (variant.stock - units < 0) {
            console.warn(
              `[inventory] ${variantId} sold ${units} with only ${variant.stock} in the ` +
                'catalogue; clamped to 0. The payment stands — correct the count by hand.',
            );
          }

          /**
           * The deduction has now been applied to the authoritative number,
           * which is exactly what `reconciled_at` records.
           *
           * Without this the same unit is subtracted twice: once because
           * the column went down, and again because `COMMITTED_RESERVATIONS`
           * goes on counting a consumed-but-unreconciled row against
           * availability.
           */
          await client.query(
            `UPDATE stock_reservations SET reconciled_at = now()
              WHERE id = ANY($1::bigint[]) AND reconciled_at IS NULL`,
            [rows.map((row) => row.id)],
          );

          // Keep the ceiling the order path reads in step with the column
          // it now mirrors. `min(baseline, live)` would otherwise pin
          // availability to whatever the stock was at the first ever sale.
          await client.query(
            `UPDATE inventory_baseline
                SET hostinger_quantity = $2, synced_at = now()
              WHERE variant_id = $1`,
            [variantId, after.rows[0]!.stock],
          );

          /**
           * Did this sale take the last unit?
           *
           * The `UPDATE ... RETURNING` above already yields the new count
           * and `variant.stock` is the old one, so the crossing is free to
           * detect and is recorded here, inside the payment transaction —
           * the transition cannot exist for a deduction that rolled back,
           * and the deduction cannot commit without it.
           *
           * **No mail is sent from here.** `dispatchStockAlertsInBackground`
           * runs after the transaction commits; an SMTP timeout inside this
           * block would roll back a payment Razorpay has already taken.
           *
           * `FOR UPDATE OF v` above serialises two captures of the same
           * variant, so only one of them can observe the crossing.
           */
          const direction = transitionBetween(variant.stock, after.rows[0]!.stock);
          if (direction) {
            await recordStockTransitions(client, [
              {
                productId: variant.product_key,
                sku: variant.sku,
                direction,
                source: 'order',
              },
            ]);
            transitionRecorded = true;
          }

          stockChanged = true;
        }

        // Ours, so there is nothing to send anywhere. Falling through to
        // the outbox would file a Hostinger job keyed on our own product
        // key — which is exactly what it used to do.
        continue;
      }

      // Not ours: the Hostinger outbox, unchanged.
      //
      // A transactional outbox. A job cannot exist without the payment, and
      // the payment cannot commit without the job, so there is no window
      // where a sale is recorded but the deduction is lost.
      //
      // Nothing is sent from here. The queue is drained outside the
      // transaction, because a 15-second network call has no business
      // holding a row lock on a paid order, and a Hostinger outage must
      // never roll back money we have already taken.
      //
      // This runs whether or not the push is switched on: the queue is then
      // a durable record of what is owed upstream, and turning the feature
      // on later settles the backlog instead of losing it.
      const productId = await productIdForVariant(client, orderId, variantId);
      if (!productId) continue;

      await client.query(
        `INSERT INTO inventory_sync_jobs
           (order_id, variant_id, hostinger_product_id, units, reservation_ids)
         VALUES ($1, $2, $3, $4, $5::bigint[])
         ON CONFLICT (order_id, variant_id) DO NOTHING`,
        [orderId, variantId, productId, units, rows.map((row) => row.id)],
      );
    }

    return { stockChanged, transitionRecorded };
  }

  async releaseReservations(orderId: number) {
    await query(
      `UPDATE stock_reservations SET state = 'released' WHERE order_id = $1 AND state = 'active'`,
      [orderId],
    );
  }

  /**
   * A cancelled order's sold units, back in stock. The reverse of
   * `consumeWithin`, inside the cancellation's transaction.
   *
   * Per variant, only for our own catalogue:
   *
   *   - **Deducted** (`reconciled_at` set): the units came off
   *     `product_variants.stock` — at the sale, or because an admin's count
   *     already reflected it — so they are added back, the ledger follows the
   *     column, and a 0 → n crossing is recorded as `back-in-stock`, which is
   *     what lets the admin send the "Notify me" emails.
   *   - **Never deducted** (`reconciled_at` null — an untracked variant, or a
   *     cash on delivery sale from before COD deducted stock): the column was
   *     never lowered, so nothing is added; releasing the row is what stops it
   *     counting against availability.
   *
   * Either way the reservation becomes `released`, so a second cancellation
   * finds nothing to return. A variant that is not ours (Hostinger) is left
   * alone: its deduction went upstream and has to be reversed there.
   */
  private async restockWithin(
    client: PoolClient,
    orderId: number,
  ): Promise<{ stockChanged: boolean; transitionRecorded: boolean }> {
    let stockChanged = false;
    let transitionRecorded = false;

    const sold = await client.query<{
      id: string;
      variant_id: string;
      quantity: number;
      reconciled: boolean;
    }>(
      `SELECT id, variant_id, quantity, reconciled_at IS NOT NULL AS reconciled
         FROM stock_reservations
        WHERE order_id = $1 AND state = 'consumed'
          FOR UPDATE`,
      [orderId],
    );

    for (const [variantId, rows] of groupByVariant(sold.rows)) {
      const owned = await client.query<{
        id: number;
        stock: number | null;
        sku: string;
        product_key: string;
      }>(
        `SELECT v.id, v.stock, v.sku, p.product_key
           FROM product_variants v
           JOIN products p ON p.id = v.product_id
          WHERE p.product_key || ':' || v.variant_key = $1
          FOR UPDATE OF v`,
        [variantId],
      );
      const variant = owned.rows[0];
      if (!variant) continue;

      const deducted = rows
        .filter((row) => row.reconciled)
        .reduce((sum, row) => sum + row.quantity, 0);

      if (variant.stock !== null && deducted > 0) {
        const after = await client.query<{ stock: number }>(
          `UPDATE product_variants SET stock = stock + $2 WHERE id = $1 RETURNING stock`,
          [variant.id, deducted],
        );
        const restocked = after.rows[0]!.stock;

        await client.query(
          `INSERT INTO inventory_baseline (variant_id, hostinger_quantity, synced_at)
           VALUES ($1, $2, now())
           ON CONFLICT (variant_id)
           DO UPDATE SET hostinger_quantity = EXCLUDED.hostinger_quantity, synced_at = now()`,
          [variantId, restocked],
        );

        const direction = transitionBetween(variant.stock, restocked);
        if (direction) {
          await recordStockTransitions(client, [
            { productId: variant.product_key, sku: variant.sku, direction, source: 'order' },
          ]);
          transitionRecorded = true;
        }
        stockChanged = true;
      }

      await client.query(
        `UPDATE stock_reservations SET state = 'released' WHERE id = ANY($1::bigint[])`,
        [rows.map((row) => row.id)],
      );
      // Releasing a never-deducted row still raises availability.
      stockChanged = true;
    }

    return { stockChanged, transitionRecorded };
  }

  private async releaseWithin(client: PoolClient, orderId: number) {
    await client.query(
      `UPDATE stock_reservations SET state = 'released' WHERE order_id = $1 AND state = 'active'`,
      [orderId],
    );
  }

  async sweepExpiredReservations(): Promise<number> {
    const rows = await query<{ id: number }>(
      `UPDATE stock_reservations SET state = 'expired'
        WHERE state = 'active' AND expires_at <= now()
        RETURNING id`,
    );
    return rows.length;
  }

  async reconciliationReport() {
    // Only unreconciled sales: once a row is stamped, the admin has already
    // deducted it upstream and it is no longer outstanding work.
    return query<{ variantId: string; sold: number; baseline: number; syncedAt: Date }>(
      `SELECT b.variant_id AS "variantId",
              COALESCE(
                sum(r.quantity) FILTER (WHERE r.state = 'consumed' AND r.reconciled_at IS NULL),
                0
              )::bigint AS sold,
              b.hostinger_quantity::bigint AS baseline,
              b.synced_at AS "syncedAt"
         FROM inventory_baseline b
         LEFT JOIN stock_reservations r ON r.variant_id = b.variant_id
        GROUP BY b.variant_id, b.hostinger_quantity, b.synced_at
       HAVING COALESCE(
                sum(r.quantity) FILTER (WHERE r.state = 'consumed' AND r.reconciled_at IS NULL),
                0
              ) > 0
        ORDER BY sold DESC`,
    );
  }

  /**
   * Re-mirror Hostinger's stock and close out the sales it now accounts for.
   *
   * Called after the admin has deducted the outstanding quantities in hPanel.
   * The two halves have to happen together, which is the whole reason this is
   * one transaction rather than a call to `syncInventoryBaseline` followed by
   * an update:
   *
   *   - writing the new baseline alone would double-count, because the
   *     consumed reservations for those same sales keep subtracting;
   *   - stamping alone would leave the baseline frozen at its old value, which
   *     is the ratchet this is meant to end.
   *
   * The baseline rows are locked in the same sorted order `createOrder` locks
   * them, so a checkout in flight either completes before the resync or sees
   * the finished result — never a half-applied one.
   */
  async reconcileInventory(
    entries: Array<{ variantId: string; quantity: number }>,
  ): Promise<{ variants: number; reservations: number }> {
    if (entries.length === 0) return { variants: 0, reservations: 0 };

    return transaction(async (client) => {
      const variantIds = [...new Set(entries.map((entry) => entry.variantId))].sort();

      // Guarantee a lockable row exists before locking, exactly as order
      // creation does — `FOR UPDATE` locks nothing if the row is absent.
      for (const variantId of variantIds) {
        await client.query(
          `INSERT INTO inventory_baseline (variant_id, hostinger_quantity)
           VALUES ($1, 0)
           ON CONFLICT (variant_id) DO NOTHING`,
          [variantId],
        );
      }

      await client.query(
        `SELECT variant_id
           FROM inventory_baseline
          WHERE variant_id = ANY($1::text[])
          ORDER BY variant_id
            FOR UPDATE`,
        [variantIds],
      );

      const stamped = await client.query(
        `UPDATE stock_reservations
            SET reconciled_at = now()
          WHERE variant_id = ANY($1::text[])
            AND state = 'consumed'
            AND reconciled_at IS NULL`,
        [variantIds],
      );

      for (const entry of entries) {
        await client.query(
          `INSERT INTO inventory_baseline (variant_id, hostinger_quantity, synced_at)
           VALUES ($1, $2, now())
           ON CONFLICT (variant_id)
           DO UPDATE SET hostinger_quantity = EXCLUDED.hostinger_quantity, synced_at = now()`,
          [entry.variantId, Math.max(0, entry.quantity)],
        );
      }

      return { variants: entries.length, reservations: stamped.rowCount ?? 0 };
    });
  }

  /* ---------------------------------------------------- customer stats */

  async customerStats(phone: string): Promise<CustomerOrderStats> {
    const row = await queryOne<{ count: number; value: number }>(
      `SELECT count(*)::bigint AS count, COALESCE(sum(total), 0)::bigint AS value
         FROM orders
        WHERE customer_phone = $1
          AND payment_method = 'cod'
          AND payment_status = 'pending'
          AND status NOT IN ('cancelled', 'delivered')`,
      [phone],
    );
    return { unpaidCodOrders: row?.count ?? 0, unpaidCodValue: row?.value ?? 0 };
  }
}

/* ------------------------------------------------------------- helpers */

class CouponLimitReached extends Error {
  constructor() {
    super('Coupon usage limit reached');
    this.name = 'CouponLimitReached';
  }
}

class InsufficientStock extends Error {
  constructor(
    readonly variantId: string,
    readonly available: number,
  ) {
    super(`Insufficient stock for ${variantId}`);
    this.name = 'InsufficientStock';
  }
}

/**
 * Signals that another transaction committed this idempotency key first.
 *
 * Thrown from inside the transaction and handled outside it, because the
 * winning row cannot be read from a snapshot that started before it committed.
 */
class IdempotencyRace extends Error {
  constructor(readonly key: string) {
    super(`Idempotency key ${key} was claimed concurrently.`);
    this.name = 'IdempotencyRace';
  }
}

function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const candidate = error as { code?: string; constraint?: string };
  if (candidate?.code !== '23505') return false;
  return constraint ? candidate.constraint === constraint : true;
}

let instance: PostgresOrderRepository | null = null;

/** Repository singleton — the only place checkout resolves storage. */
export function orders(): PostgresOrderRepository {
  if (!instance) instance = new PostgresOrderRepository();
  return instance;
}
