import type { Paise } from '@/lib/commerce/types';

/**
 * Order domain types.
 *
 * These mirror the `itarang_dev` schema but are storage-agnostic: checkout
 * logic depends on these types and on `OrderRepository`, never on `pg`. Moving
 * to a different database later is a new repository implementation, not a
 * rewrite of checkout.
 */

export type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';

export type ReservationState = 'active' | 'consumed' | 'released' | 'expired';

/** `cod` needs no gateway; `mock` is local-only; `razorpay-test` is inert for now. */
export type PaymentMethod = 'cod' | 'mock' | 'razorpay-test';

export interface ShippingAddress {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderContact {
  name: string;
  phone: string;
  email?: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantTitle?: string;
  image?: string;
  unitMrp: Paise;
  unitPrice: Paise;
  quantity: number;
  lineTotal: Paise;
  hsnCode?: string;
  taxRate: number;
  installationIncluded: boolean;
}

export interface OrderAmounts {
  subtotal: Paise;
  productSavings: Paise;
  couponCode?: string;
  couponDiscount: Paise;
  shipping: Paise;
  codFee: Paise;
  total: Paise;
  gstAmount: Paise;
  gstRate: number;
}

export interface Order {
  id: number;
  orderNumber: string;
  /**
   * The account that placed this order.
   *
   * Undefined only on historical guest orders, placed before accounts existed.
   * Every new order has one — enforced in `placeOrder`, not by a NOT NULL
   * constraint, which would have invalidated that history.
   */
  userId?: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  contact: OrderContact;
  shippingAddress: ShippingAddress;
  amounts: OrderAmounts;
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  /** Permanent marker: this order did not involve real money. */
  isTest: boolean;
  placeOfSupply?: string;
  buyerGstin?: string;
  sellerGstin?: string;
  idempotencyKey?: string;
  gatewayOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderEvent {
  id: number;
  orderId: number;
  fromStatus: string | null;
  toStatus: string;
  actor: string;
  note?: string;
  createdAt: string;
}

export interface PaymentRecord {
  id: number;
  orderId: number;
  provider: string;
  gatewayPaymentId: string;
  status: PaymentStatus;
  amount: Paise;
  method?: string;
  signatureVerified: boolean;
  errorCode?: string;
  errorDescription?: string;
  createdAt: string;
}

export interface StockReservation {
  id: number;
  variantId: string;
  orderId: number | null;
  quantity: number;
  state: ReservationState;
  expiresAt: string;
  createdAt: string;
}

/** Everything needed to persist a new order, computed server-side. */
export interface NewOrder {
  orderNumber: string;
  /** Required for every new order. See `Order.userId`. */
  userId?: number;
  contact: OrderContact;
  shippingAddress: ShippingAddress;
  amounts: OrderAmounts;
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  isTest: boolean;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placeOfSupply?: string;
  buyerGstin?: string;
  sellerGstin?: string;
  idempotencyKey?: string;
  gatewayOrderId?: string;
}
