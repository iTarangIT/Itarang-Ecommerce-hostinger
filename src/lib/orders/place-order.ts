import { env } from '@/lib/env';
import { paymentProvider, type PaymentIntent } from '@/lib/payments';
import { couponRule } from '@/lib/offers/coupons';
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

  /* ---------------------------------------------------- coupon re-use */

  // `validateCoupon` cannot check this. It is shared with the cart UI and has
  // no database access by design, so the only place a per-customer limit can
  // be enforced is here, on the server, immediately before the order is
  // written. The matching redemption row is inserted inside the order's own
  // transaction, so the two cannot disagree.
  //
  // Residual race: two orders submitted at the same instant could both pass
  // this check. `coupon_redemptions` has no unique constraint to lean on —
  // adding a blanket one would wrongly stop a customer using a *multi*-use
  // code twice — and the idempotency key already blocks accidental double
  // submits. Worth tightening if these ever carry real money.
  if (quote.coupon) {
    const rule = couponRule(quote.coupon.code);
    if (rule?.oncePerCustomer) {
      const alreadyUsed = await repository.hasRedeemedCoupon(
        quote.coupon.code,
        input.contact.phone,
      );
      if (alreadyUsed) {
        return {
          ok: false,
          code: 'invalid_quote',
          quote,
          issues: [
            ...quote.issues,
            {
              code: 'coupon_invalid',
              message:
                `${quote.coupon.code} has already been used on a previous order. ` +
                'Remove it to continue.',
            },
          ],
        };
      }
    }
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
    // Nothing in this build takes real money, and the flag records that
    // permanently rather than leaving it to be inferred later.
    isTest: true,
    status: isCod ? ('confirmed' as const) : ('pending_payment' as const),
    paymentStatus: 'pending' as const,
    placeOfSupply: stateCode(input.address.state),
    buyerGstin: input.gstin || undefined,
    sellerGstin: config.SELLER_GSTIN || undefined,
    idempotencyKey: input.idempotencyKey,
  };

  // `maxQuantity` on a quote line is the variant's live stock, read from the
  // catalogue moments ago — the figure the repository checks against.
  const availableByVariant = Object.fromEntries(
    quote.items.map((item) => [item.id, item.maxQuantity]),
  );

  const created = await repository.createOrder({
    order: newOrder,
    reservations: quote.items.map((item) => ({ variantId: item.id, quantity: item.quantity })),
    availableByVariant,
    reservationTtlMinutes: config.RESERVATION_TTL_MINUTES,
  });

  if (!created.ok) {
    return { ok: false, code: 'insufficient_stock', variantId: created.variantId, available: created.available };
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
