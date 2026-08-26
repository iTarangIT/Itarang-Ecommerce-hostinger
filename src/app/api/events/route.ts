import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { callerIp, consume, LIMITS } from '@/lib/security/rate-limit';
import { crossOriginRejection } from '@/lib/security/origin';
import { isFunnelEvent, record, visitorContext } from '@/lib/analytics/events';
import { catalog } from '@/lib/commerce';

export const dynamic = 'force-dynamic';

/**
 * Funnel beacon ingestion.
 *
 * The only thing a browser is trusted to tell us here is *what it did* — never
 * who it is, never what anything costs, and never that money moved.
 *
 *   identity   `visitor_id` comes from an HttpOnly cookie this route mints, and
 *              `user_id` from the session. Neither is readable from the body,
 *              so a forged payload cannot attribute activity to someone else.
 *   catalogue  `productId`/`variantId` are checked against the live catalogue.
 *              An unknown id is dropped rather than stored, so the product
 *              funnel cannot be seeded with ids that were never for sale.
 *   money      `value` is recomputed server-side from the catalogue. A client
 *              claiming a ₹90,000 add-to-cart does not get one.
 *   replay     every write carries a unique `dedupe_key`.
 *
 * It answers 204 to everything it accepts, including duplicates. `sendBeacon`
 * discards the response and cannot retry, so there is nothing useful to say and
 * no reason to spend bytes saying it.
 *
 * Nothing financial is derived from this table. Payment and order stages come
 * from `payments` and `order_events`, which a browser cannot write to at all.
 */

const bodySchema = z.object({
  event: z.string().max(32),
  productId: z.string().max(128).optional(),
  variantId: z.string().max(128).optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  /** Scopes idempotency; never trusted for anything else. */
  dedupe: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  // Same origin check every mutating handler applies. A beacon is same-origin
  // by construction, so anything cross-origin is not a shopper.
  const rejection = crossOriginRejection(request);
  if (rejection) return rejection;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (!isFunnelEvent(parsed.event)) {
    return new NextResponse(null, { status: 204 });
  }

  // Minting the cookies is itself the reason this is a route handler: Next.js
  // forbids writing cookies during an ordinary page render.
  const visitor = await visitorContext();

  const [perVisitor, perIp] = await Promise.all([
    consume(`events:${visitor.visitorId}`, LIMITS.events),
    consume(`events:ip:${await callerIp()}`, LIMITS.eventsByIp),
  ]);

  // 204 rather than 429: the beacon cannot act on either answer, and telling a
  // script precisely when it was throttled is free information it does not need.
  if (!perVisitor.allowed || !perIp.allowed) {
    return new NextResponse(null, { status: 204 });
  }

  const user = await currentUser();

  /* ------------------------------------------------ catalogue validation */

  let productId: string | null = null;
  let variantId: string | null = null;
  let value: number | null = null;

  if (parsed.productId) {
    const product = await findProduct(parsed.productId);
    if (!product) {
      // An id that is not in the catalogue is not evidence of anything.
      return new NextResponse(null, { status: 204 });
    }

    productId = product.id;

    const variant =
      product.variants.find((candidate) => candidate.id === parsed.variantId) ??
      product.variants[0];

    if (parsed.variantId && !product.variants.some((c) => c.id === parsed.variantId)) {
      return new NextResponse(null, { status: 204 });
    }

    variantId = variant?.id ?? null;

    // Priced here, from the catalogue, never from the request.
    if (variant && parsed.quantity) {
      value = variant.price.selling * parsed.quantity;
    }
  }

  await record({
    event: parsed.event,
    visitor,
    userId: user?.id ?? null,
    productId,
    variantId,
    quantity: parsed.quantity ?? null,
    value,
    dedupe: parsed.dedupe,
  });

  return new NextResponse(null, { status: 204 });
}

/**
 * Resolve a product id against the live catalogue.
 *
 * Reads the provider's own snapshot, which is already in memory and already
 * shared across requests, so validation costs no upstream call on the hot path.
 */
async function findProduct(productId: string) {
  try {
    const [product] = await catalog().getProductsByIds([productId]);
    return product ?? null;
  } catch (error) {
    console.warn(`[funnel] catalogue lookup failed: ${(error as Error).message}`);
    return null;
  }
}
