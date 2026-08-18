import type { PoolClient } from 'pg';
import { query, queryOne, transaction } from '@/lib/db/pool';
import { generateOrderNumber } from './numbering';
import { isPaymentAdvance, orderStatusForPayment } from './state-machine';
import type {
  CreateOrderInput,
  CreateOrderResult,
  CustomerAwareRepository,
  CustomerOrderStats,
  OrderListFilters,
  OrderRepository,
} from './repository';
import type {
  Order,
  OrderEvent,
  OrderItem,
  OrderStatus,
  PaymentRecord,
  PaymentStatus,
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
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const ORDER_COLUMNS = `
  id, order_number, status, payment_status,
  customer_name, customer_phone, customer_email, shipping_address,
  subtotal, product_savings, coupon_code, coupon_discount, shipping, cod_fee,
  total, gst_amount, gst_rate, place_of_supply, buyer_gstin, seller_gstin,
  payment_method, is_test, idempotency_key, gateway_order_id,
  created_at, updated_at`;

/** Reservations that still count against stock: active-and-unexpired, or sold. */
const COMMITTED_RESERVATIONS = `
  (state = 'consumed' OR (state = 'active' AND expires_at > now()))`;

/* -------------------------------------------------------- implementation */

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

  findByGatewayOrderId(gatewayOrderId: string) {
    return this.findOneBy('gateway_order_id = $1', [gatewayOrderId]);
  }

  findForCustomer(orderNumber: string, phone: string) {
    return this.findOneBy('order_number = $1 AND customer_phone = $2', [orderNumber, phone]);
  }

  async listOrders(filters: OrderListFilters) {
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
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      const i = params.length;
      conditions.push(`(order_number ILIKE $${i} OR customer_phone ILIKE $${i} OR customer_name ILIKE $${i})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = filters.offset ?? 0;

    const totalRow = await queryOne<{ count: number }>(
      `SELECT count(*)::bigint AS count FROM orders ${where}`,
      params,
    );

    const rows = await query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders ${where}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params,
    );

    return { orders: await this.hydrate(rows), total: totalRow?.count ?? 0 };
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
      for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
        try {
          const result = await client.query<OrderRow>(
            `INSERT INTO orders (
               order_number, status, payment_status,
               customer_name, customer_phone, customer_email, shipping_address,
               subtotal, product_savings, coupon_code, coupon_discount, shipping, cod_fee,
               total, gst_amount, gst_rate, place_of_supply, buyer_gstin, seller_gstin,
               payment_method, is_test, idempotency_key, gateway_order_id
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23
             ) RETURNING ${ORDER_COLUMNS}`,
            [
              orderNumber,
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
            ],
          );
          inserted = result.rows[0];
        } catch (error) {
          if (isUniqueViolation(error, 'orders_order_number_key')) {
            orderNumber = generateOrderNumber();
            continue;
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

      const [hydrated] = await this.hydrateWithin(client, [inserted]);
      return { ok: true, order: hydrated, reused: false } as CreateOrderResult;
    }).catch((error: unknown) => {
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

  async setGatewayOrderId(orderId: number, gatewayOrderId: string) {
    await query(`UPDATE orders SET gateway_order_id = $2 WHERE id = $1`, [orderId, gatewayOrderId]);
  }

  /* ---------------------------------------------------------- payments */

  async recordPayment(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<boolean> {
    const rows = await query<{ id: number }>(
      `INSERT INTO payments (
         order_id, provider, gateway_payment_id, status, amount, method,
         signature_verified, error_code, error_description
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (provider, gateway_payment_id) DO NOTHING
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
    return transaction(async (client) => {
      const current = await client.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      );
      const row = current.rows[0];
      if (!row) return null;

      if (!isPaymentAdvance(row.payment_status, status)) {
        const [unchanged] = await this.hydrateWithin(client, [row]);
        return unchanged;
      }

      const nextOrderStatus = orderStatusForPayment(status, row.status);

      const updated = await client.query<OrderRow>(
        `UPDATE orders SET payment_status = $2, status = $3 WHERE id = $1
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
        await client.query(
          `UPDATE stock_reservations SET state = 'consumed'
            WHERE order_id = $1 AND state = 'active'`,
          [orderId],
        );
      }

      const [hydrated] = await this.hydrateWithin(client, updated.rows);
      return hydrated;
    });
  }

  async transitionOrderStatus(
    orderId: number,
    to: OrderStatus,
    actor: string,
    note?: string,
  ): Promise<Order | null> {
    return transaction(async (client) => {
      const current = await client.query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1 FOR UPDATE`,
        [orderId],
      );
      const row = current.rows[0];
      if (!row) return null;

      const updated = await client.query<OrderRow>(
        `UPDATE orders SET status = $2 WHERE id = $1 RETURNING ${ORDER_COLUMNS}`,
        [orderId, to],
      );

      await client.query(
        `INSERT INTO order_events (order_id, from_status, to_status, actor, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, row.status, to, actor, note ?? null],
      );

      if (to === 'cancelled') {
        await this.releaseWithin(client, orderId);
      }

      const [hydrated] = await this.hydrateWithin(client, updated.rows);
      return hydrated;
    });
  }

  async listEvents(orderId: number): Promise<OrderEvent[]> {
    const rows = await query<{
      id: number;
      order_id: number;
      from_status: string | null;
      to_status: string;
      actor: string;
      note: string | null;
      created_at: Date;
    }>(`SELECT * FROM order_events WHERE order_id = $1 ORDER BY created_at, id`, [orderId]);

    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      actor: row.actor,
      note: row.note ?? undefined,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /** False when this event has already been recorded — the replay guard. */
  async recordWebhookEvent(
    provider: string,
    eventId: string,
    eventType: string,
    payload: unknown,
  ): Promise<boolean> {
    const rows = await query<{ id: number }>(
      `INSERT INTO webhook_events (provider, event_id, event_type, payload, processed_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING id`,
      [provider, eventId, eventType, JSON.stringify(payload)],
    );
    return rows.length > 0;
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

  async consumeReservations(orderId: number) {
    await query(
      `UPDATE stock_reservations SET state = 'consumed' WHERE order_id = $1 AND state = 'active'`,
      [orderId],
    );
  }

  async releaseReservations(orderId: number) {
    await query(
      `UPDATE stock_reservations SET state = 'released' WHERE order_id = $1 AND state = 'active'`,
      [orderId],
    );
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
    return query<{ variantId: string; sold: number; baseline: number }>(
      `SELECT b.variant_id AS "variantId",
              COALESCE(sum(r.quantity) FILTER (WHERE r.state = 'consumed'), 0)::bigint AS sold,
              b.hostinger_quantity::bigint AS baseline
         FROM inventory_baseline b
         LEFT JOIN stock_reservations r ON r.variant_id = b.variant_id
        GROUP BY b.variant_id, b.hostinger_quantity
       HAVING COALESCE(sum(r.quantity) FILTER (WHERE r.state = 'consumed'), 0) > 0
        ORDER BY sold DESC`,
    );
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

class InsufficientStock extends Error {
  constructor(
    readonly variantId: string,
    readonly available: number,
  ) {
    super(`Insufficient stock for ${variantId}`);
    this.name = 'InsufficientStock';
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
