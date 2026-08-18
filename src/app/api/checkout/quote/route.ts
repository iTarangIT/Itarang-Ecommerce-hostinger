import { NextResponse } from 'next/server';
import { buildQuote } from '@/lib/orders/quote';
import { fieldErrors, quoteRequestSchema } from '@/lib/checkout/validation';

export const dynamic = 'force-dynamic';

/**
 * Server-side quote — the pricing authority.
 *
 * The client sends variant ids and quantities only. Prices, discounts,
 * shipping, COD fee and GST are all recomputed here, so what the shopper is
 * charged never depends on what the browser claimed.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

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
