import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import { orders } from '@/lib/orders/postgres-repository';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import { PHONE_PATTERN } from '@/lib/checkout/validation';

export const dynamic = 'force-dynamic';

/**
 * Order lookup, by either of two routes.
 *
 * **Owner** — a signed-in customer reading their own order, matched on
 * `orders.user_id`; or an admin, who may read any. No phone number needed.
 *
 * **Guest** — order number *plus* the phone number on the order. Retained for
 * historical orders placed before checkout required an account, and for
 * `/track`. The order number alone is never enough: without the second factor
 * anyone holding a number could read a stranger's address and contact details.
 *
 * A wrong phone number and a non-existent order return the same response, so
 * this cannot be used to discover which order numbers exist. The same is true
 * of an order that exists but belongs to somebody else.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;
  const normalised = normaliseOrderNumber(orderNumber);
  const repository = orders();
  const user = await currentUser();

  let order = null;

  if (user) {
    order =
      user.role === 'admin'
        ? await repository.findByOrderNumber(normalised)
        : await repository.findForOwner(normalised, user.id);
  }

  // Not theirs, or not signed in: fall back to the guest factor.
  if (!order) {
    // Order number plus a 10-digit phone is brute-forceable given unlimited
    // attempts, and this is the only path that accepts a guess. Counted per
    // IP, and only on the guessing path — an owner reading their own order via
    // their session never touches this.
    const rate = await consume(`order-lookup:ip:${await callerIp()}`, LIMITS.orderLookup);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many lookups. Please wait a few minutes and try again.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, rate.resetSeconds)) } },
      );
    }

    const phone = new URL(request.url).searchParams.get('phone')?.trim() ?? '';

    if (!PHONE_PATTERN.test(phone)) {
      return NextResponse.json(
        { error: 'The mobile number on the order is required.' },
        { status: 400 },
      );
    }

    order = await repository.findForCustomer(normalised, phone);
  }

  if (!order) {
    // Deliberately identical for "no such order", "wrong phone" and
    // "somebody else's order" — none of them may be told apart.
    return NextResponse.json(
      { error: 'No order matches that order number and mobile number.' },
      { status: 404 },
    );
  }

  const events = await repository.listEvents(order.id);

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      isTest: order.isTest,
      placedAt: order.createdAt,
      total: order.amounts.total,
      amounts: order.amounts,
      items: order.items.map((item) => ({
        title: item.title,
        variantTitle: item.variantTitle,
        image: item.image,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      })),
      shippingAddress: order.shippingAddress,
      contactName: order.contact.name,
    },
    timeline: events.map((event) => ({
      status: event.toStatus,
      note: event.note,
      at: event.createdAt,
    })),
  });
}
