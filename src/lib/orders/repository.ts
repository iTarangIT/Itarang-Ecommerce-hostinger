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

  /** Guest lookup — requires the phone number on the order. */
  findForCustomer(orderNumber: string, phone: string): Promise<Order | null>;

  listOrders(filters: OrderListFilters): Promise<{ orders: Order[]; total: number }>;

  setGatewayOrderId(orderId: number, gatewayOrderId: string): Promise<void>;

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

  /** Returns false when this event id has already been processed. */
  recordWebhookEvent(
    provider: string,
    eventId: string,
    eventType: string,
    payload: unknown,
  ): Promise<boolean>;

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
