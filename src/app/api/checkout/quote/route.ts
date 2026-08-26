import { NextResponse } from 'next/server';
import { buildQuote } from '@/lib/orders/quote';
import { fieldErrors, quoteRequestSchema } from '@/lib/checkout/validation';
import { requireCustomer } from '@/lib/orders/checkout-auth';
import { LIMITS } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Server-side quote — the pricing authority.
 *
 * The client sends variant ids and quantities only. Prices, discounts,
 * shipping, COD fee and GST are all recomputed here, so what the shopper is
 * charged never depends on what the browser claimed.
 *
 * Gated like its siblings. This was the one checkout endpoint with no origin
 * check, no authentication and no rate limit, while each call fans out into a
 * full catalogue read — a cheap way for anybody to make the server do real
 * work. Requiring a session costs nothing legitimate: `/checkout` already
 * calls `requireUser`, so every caller of this endpoint is signed in anyway.
 *
 * The limit is its own bucket rather than the placement one, because the form
 * re-quotes on every debounced edit and would otherwise burn the quota that
 * protects order placement.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const auth = await requireCustomer(request, LIMITS.quote, 'quote');
  if (!auth.ok) return auth.response;

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request.', fields: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  const quote = await buildQuote(parsed.data);

  return NextResponse.json({
    items: quote.items,
    totals: quote.totals,
    coupon: quote.coupon,
    issues: quote.issues,
    serviceability: quote.serviceability,
    codAvailable: quote.codAvailable,
    codFee: quote.codFee,
    placeable: quote.placeable,
  });
}
