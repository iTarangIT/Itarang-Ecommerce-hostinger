import type { Paise } from '@/lib/commerce/types';
import type {
  NewOrder,
  Order,
  OrderEvent,
  OrderStatus,
  PaymentRecord,
  PaymentStatus,
  StockReservation,
} from './types';

/**
 * Storage contract for checkout.
 *
 * Checkout logic depends on this interface and never on `pg`. Replacing the
 * local testing database with a production one later means writing a second
 * implementation, not touching a single checkout code path.
 */

export interface ReservationRequest {
  variantId: string;
  quantity: number;
}

export interface CreateOrderInput {
  order: NewOrder;
  reservations: ReservationRequest[];
  /** Live stock read from the catalogue at placement, for the oversell check. */
  availableByVariant: Record<string, number>;
  reservationTtlMinutes: number;
}

export type CreateOrderResult =
  | { ok: true; order: Order; reused: boolean }
  | { ok: false; reason: 'insufficient_stock'; variantId: string; available: number };

export interface OrderListFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface OrderRepository {
  /**
   * Create an order, its items and its stock reservations in one transaction.
   *
   * Idempotent: calling twice with the same `idempotencyKey` returns the first
   * order with `reused: true` rather than creating a second.
   */
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;

  findByOrderNumber(orderNumber: string): Promise<Order | null>;
  findById(id: number): Promise<Order | null>;
  findByIdempotencyKey(key: string): Promise<Order | null>;
  findByGatewayOrderId(gatewayOrderId: string): Promise<Order | null>;

  /**
   * Guest lookup — order number plus the phone number on the order, and only
   * for orders with no owner.
   *
   * Retained for historical orders placed before accounts existed, and for
   * `/track`. An order that belongs to an account is reachable only through
   * `findForOwner`, so this cannot be used to read somebody else's order.
   */
  findForCustomer(orderNumber: string, phone: string): Promise<Order | null>;

  /** Owner lookup — the account must match `orders.user_id`. */
  findForOwner(orderNumber: string, userId: number): Promise<Order | null>;

  /** This account's own order history. */
  listOrdersForUser(
    userId: number,
    limit?: number,
    offset?: number,
  ): Promise<{ orders: Order[]; total: number }>;

  listOrders(filters: OrderListFilters): Promise<{ orders: Order[]; total: number }>;

  /** Point the order at a gateway order, recording it in the attempt history. */
  setGatewayOrderId(orderId: number, gatewayOrderId: string, provider?: string): Promise<void>;

  /** Every gateway order ever created for this order, newest first. */
  listPaymentAttempts(orderId: number): Promise<
    Array<{ gatewayOrderId: string; provider: string; amount: number; supersededAt: string | null }>
  >;

  /** Records a payment attempt. Returns false when the id was already seen. */
  recordPayment(payment: Omit<PaymentRecord, 'id' | 'createdAt'>): Promise<boolean>;
  listPayments(orderId: number): Promise<PaymentRecord[]>;

  /**
   * Apply a payment outcome. Ignores states that would move the payment
   * backwards, so a late or duplicated webhook is harmless.
   */
  applyPaymentStatus(
    orderId: number,
    status: PaymentStatus,
    actor: string,
    note?: string,
  ): Promise<Order | null>;

  transitionOrderStatus(
    orderId: number,
    to: OrderStatus,
    actor: string,
    note?: string,
  ): Promise<Order | null>;

  listEvents(orderId: number): Promise<OrderEvent[]>;

  /**
   * Claim a webhook event. Returns false when this event id was already claimed.
   *
   * Two-phase on purpose: the row is written with `processed_at` NULL and only
   * stamped by `completeWebhookEvent` once the event has been applied, so a
   * failure in between leaves work that can be found and retried instead of a
   * payment update that is silently lost.
   */
  beginWebhookEvent(
    provider: string,
    eventId: string,
    eventType: string,
    payload: unknown,
  ): Promise<boolean>;

  /** Mark a claimed event finished. */
  completeWebhookEvent(provider: string, eventId: string): Promise<void>;

  /** Release a claim after a failure, so the gateway's retry is let through. */
  abandonWebhookEvent(provider: string, eventId: string): Promise<void>;

  /** Claimed but never completed — events that need a second look. */
  unprocessedWebhookEvents(olderThanMinutes?: number): Promise<
    Array<{ id: number; provider: string; eventId: string; eventType: string; receivedAt: string }>
  >;

  /* ------------------------------------------------------- inventory */

  /** Mirror Hostinger's stock as the opening balance for our ledger. */
  syncInventoryBaseline(entries: Array<{ variantId: string; quantity: number }>): Promise<void>;

  /** Baseline minus active reservations minus unreconciled sales. */
  availability(variantIds: string[]): Promise<Record<string, number>>;

  listReservations(orderId: number): Promise<StockReservation[]>;
  consumeReservations(orderId: number): Promise<void>;
  releaseReservations(orderId: number): Promise<void>;
  /** Marks expired rows; tidiness only — reads already exclude them. */
  sweepExpiredReservations(): Promise<number>;

  /** Units sold since the last Hostinger sync, for manual reconciliation. */
  reconciliationReport(): Promise<Array<{ variantId: string; sold: number; baseline: number }>>;
}

/** Total value of a set of reservations — used by COD abuse caps. */
export interface CustomerOrderStats {
  unpaidCodOrders: number;
  unpaidCodValue: Paise;
}

export interface CustomerAwareRepository {
  customerStats(phone: string): Promise<CustomerOrderStats>;
}
