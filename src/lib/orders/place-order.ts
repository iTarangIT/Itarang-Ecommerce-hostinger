import { env } from '@/lib/env';
import { allProducts } from '@/lib/catalog/collections';
import { CUSTOMER_QUANTITY_CEILING } from '@/lib/commerce/purchase';
import { paymentProvider, type PaymentIntent } from '@/lib/payments';
import { stateCode } from '@/lib/checkout/validation';
import type { AddressInput, ContactInput } from '@/lib/checkout/validation';
import { buildQuote, type QuoteIssue, type QuoteResult } from './quote';
import { generateOrderNumber } from './numbering';
import { orders } from './postgres-repository';
import type { Order, PaymentMethod } from './types';

/**
 * Order placement.
 *
 * Shared by the COD and online payment routes so both take exactly the same
 * path: quote → validate → reserve → persist → (payment intent). The only
 * divergence is that COD never asks for a payment intent.
 *
 * The quote is rebuilt here rather than trusted from the client, so the amount
 * stored on the order is always the server's own figure.
 */

export interface PlaceOrderInput {
  /**
   * The authenticated customer placing the order. Required.
   *
   * `orders.user_id` is nullable in the schema so that guest orders placed
   * before accounts existed remain valid, but no *new* order may be
   * ownerless — that invariant lives here, and the routes return 401 rather
   * than reaching this function without it.
   */
  userId: number;
  lines: Array<{ variantId: string; quantity: number }>;
  contact: ContactInput;
  address: AddressInput;
  couponCode?: string;
  gstin?: string;
  paymentMethod: PaymentMethod;
  payVia?: 'upi';
  idempotencyKey?: string;
  /** What the browser displayed, in paise. Advisory — see `placeOrder`. */
  expectedTotal?: number;
  /** The shopper has seen the new price and agreed to it. */
  acceptPriceChange?: boolean;
}

export type PlaceOrderResult =
  | { ok: true; order: Order; intent: PaymentIntent | null; reused: boolean }
  | { ok: false; code: 'invalid_quote'; issues: QuoteIssue[]; quote: QuoteResult }
  | { ok: false; code: 'insufficient_stock'; variantId: string; available: number }
  | {
      ok: false;
      code: 'price_changed';
      expectedTotal: number;
      total: number;
      issues: QuoteIssue[];
      quote: QuoteResult;
    }
  | { ok: false; code: 'cod_limit'; message: string };

/** Unpaid COD orders a single phone number may hold at once. */
const MAX_OPEN_COD_ORDERS = 3;

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const config = env();
  const repository = orders();

  const quote = await buildQuote({
    lines: input.lines,
    couponCode: input.couponCode,
    pincode: input.address.pincode,
    paymentMethod: input.paymentMethod,
    payVia: input.payVia,
    shopper: {
      userId: input.userId,
      phone: input.contact.phone,
      city: input.address.city,
      state: input.address.state,
      final: true,
    },
  });

  if (!quote.placeable) {
    return { ok: false, code: 'invalid_quote', issues: quote.issues, quote };
  }

  /* --------------------------------------------------------- price drift */

  // Hostinger owns the price and can change it at any moment. The quote the
  // shopper read and the quote this function just rebuilt are two independent
  // catalogue reads with nothing binding them, so a price that moved in
  // between would previously have been charged silently.
  //
  // `expectedTotal` is what the browser displayed. It is advisory and is never
  // used to price anything — the rebuilt quote above remains the sole
  // authority. All this can do is *refuse* an order whose price moved, which
  // is why trusting the client with it is safe: it cannot be used to pay less,
  // only to be told sooner.
  if (
    input.expectedTotal !== undefined &&
    !input.acceptPriceChange &&
    input.expectedTotal !== quote.totals.total
  ) {
    const direction = quote.totals.total > input.expectedTotal ? 'gone up' : 'come down';
    return {
      ok: false,
      code: 'price_changed',
      expectedTotal: input.expectedTotal,
      total: quote.totals.total,
      quote,
      issues: [
        ...quote.issues,
        {
          code: 'price_changed',
          message:
            `The price has ${direction} since you opened checkout. ` +
            'Please review the new total before continuing.',
        },
      ],
    };
  }

  /* ------------------------------------------------------ coupon rules */

  // The quote above ran every campaign rule with the full picture — this
  // account, the contact phone, the delivery city and state — and dropped the
  // coupon if any failed. Placing the order without it would charge more than
  // the shopper agreed to, so the order is refused with the reason instead.
  // Usage limits are checked once more inside the order's own transaction
  // (`createOrder`), which is what stops two simultaneous orders both using
  // the last redemption.
  const couponRefusal = input.couponCode
    ? quote.issues.find((issue) => issue.code === 'coupon_invalid')
    : undefined;
  if (couponRefusal) {
    return {
      ok: false,
      code: 'invalid_quote',
      quote,
      issues: [
        ...quote.issues.filter((issue) => issue !== couponRefusal),
        { ...couponRefusal, message: `${couponRefusal.message} Remove it to continue.` },
      ],
    };
  }

  /* ------------------------------------------------------- COD limits */

  if (input.paymentMethod === 'cod') {
    const stats = await repository.customerStats(input.contact.phone);
    if (stats.unpaidCodOrders >= MAX_OPEN_COD_ORDERS) {
      return {
        ok: false,
        code: 'cod_limit',
        message:
          `There are already ${stats.unpaidCodOrders} cash-on-delivery orders open for this ` +
          'number. Please complete or cancel one before placing another.',
      };
    }
  }

  /* --------------------------------------------------- build the order */

  // COD is confirmed immediately; an online order waits for payment.
  const isCod = input.paymentMethod === 'cod';
  const provider = isCod ? null : paymentProvider();

  const newOrder = {
    orderNumber: generateOrderNumber(),
    contact: {
      name: input.contact.name,
      phone: input.contact.phone,
      email: input.contact.email || undefined,
    },
    shippingAddress: {
      line1: input.address.line1,
      line2: input.address.line2 || undefined,
      landmark: input.address.landmark || undefined,
      city: input.address.city,
      state: input.address.state,
      pincode: input.address.pincode,
    },
    amounts: {
      subtotal: quote.totals.subtotal,
      productSavings: quote.totals.productSavings,
      couponCode: quote.coupon?.code,
      couponDiscount: quote.totals.couponDiscount,
      paymentDiscount: quote.totals.paymentDiscount,
      shipping: quote.totals.shipping,
      codFee: quote.totals.codFee,
      total: quote.totals.total,
      gstAmount: quote.totals.gstIncluded,
      gstRate: 0.18,
    },
    items: quote.orderItems,
    userId: input.userId,
    // Derived from the provider that will actually run, never from the request
    // body. A client could previously post `paymentMethod: 'razorpay-test'` to
    // a mock build and get an order row labelled razorpay-test whose payment
    // rows all said 'mock' — the order's own record of how it was paid
    // disagreeing with the payments attached to it.
    paymentMethod: isCod ? ('cod' as const) : provider!.id,
    // Whether this build takes real money, recorded permanently rather than
    // left to be inferred later. COD follows the build's payment mode: a COD
    // order placed on the live store is a real sale.
    isTest: (provider ?? paymentProvider()).isTestOnly,
    status: isCod ? ('confirmed' as const) : ('pending_payment' as const),
    paymentStatus: 'pending' as const,
    placeOfSupply: stateCode(input.address.state),
    buyerGstin: input.gstin || undefined,
    sellerGstin: config.SELLER_GSTIN || undefined,
    idempotencyKey: input.idempotencyKey,
  };

  // The variant's live stock, read from the catalogue moments ago — the figure
  // the repository checks against. Not `maxQuantity` on the quote line: that
  // is the cart stepper's ceiling, capped at CUSTOMER_QUANTITY_CEILING so the
  // real count never reaches the browser. Used here it made 10 the most any
  // product could ever hold, and seeded the stock ledger at 10.
  const products = await allProducts();
  const stockOf = new Map(
    products.flatMap((product) => product.variants.map((variant) => [variant.id, variant.stock])),
  );
  const availableByVariant = Object.fromEntries(
    quote.items.map((item) => [item.id, stockOf.get(item.id) ?? 0]),
  );

  const created = await repository.createOrder({
    order: newOrder,
    reservations: quote.items.map((item) => ({ variantId: item.id, quantity: item.quantity })),
    availableByVariant,
    reservationTtlMinutes: config.RESERVATION_TTL_MINUTES,
    couponLimits: quote.campaign
      ? {
          userId: input.userId,
          maxTotal: quote.campaign.maxRedemptionsTotal,
          maxPerCustomer: quote.campaign.maxPerCustomer,
        }
      : undefined,
  });

  if (!created.ok && created.reason === 'coupon_limit') {
    return {
      ok: false,
      code: 'invalid_quote',
      quote,
      issues: [
        ...quote.issues,
        {
          code: 'coupon_invalid',
          message: `${quote.coupon?.code ?? 'This code'} has just reached its usage limit. Remove it to continue.`,
        },
      ],
    };
  }

  if (!created.ok) {
    // This result is sent to the browser as-is, so the count is capped the way
    // the cart's is: "fewer than you asked for", never the figure we hold.
    return {
      ok: false,
      code: 'insufficient_stock',
      variantId: created.variantId,
      available: Math.min(created.available, CUSTOMER_QUANTITY_CEILING),
    };
  }

  const order = created.order;

  // A repeated submit returns the original order untouched — no second
  // reservation, no second payment intent.
  if (created.reused) {
    return { ok: true, order, intent: null, reused: true };
  }

  /* ------------------------------------------------------------- COD */

  if (isCod) {
    // The sale is committed the moment a COD order is confirmed.
    await repository.consumeReservations(order.id);
    return { ok: true, order, intent: null, reused: false };
  }

  /* ---------------------------------------------------------- online */

  const intent = await provider!.createIntent(order);
  await repository.setGatewayOrderId(order.id, intent.gatewayOrderId, provider!.id);

  return {
    ok: true,
    order: { ...order, gatewayOrderId: intent.gatewayOrderId },
    intent,
    reused: false,
  };
}
