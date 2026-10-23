import { NextResponse } from 'next/server';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { quoteLineSchema } from '@/lib/checkout/validation';
import { RATE_LIMITED } from '@/lib/orders/checkout-auth';
import { buildQuote } from '@/lib/orders/quote';
import { crossOriginRejection } from '@/lib/security/origin';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  code: z.string().trim().min(1, 'Enter a coupon code.').max(40),
  lines: z.array(quoteLineSchema).max(50),
});

/**
 * Check a coupon code from the cart, against the campaign as the admin set it.
 *
 * The cart used to validate codes in the browser against a hardcoded list.
 * Campaigns now live in the database with dates, limits and customer rules, so
 * the cart asks here instead — the same `buildQuote` checkout uses, priced from
 * the catalogue. Signed out is allowed: rules that need the account (first
 * order, customer type, per-customer limit) or the delivery address are
 * checked again at checkout, where both are known.
 */
export async function POST(request: Request) {
  const rejected = crossOriginRejection(request);
  if (rejected) return rejected;

  const user = await currentUser();
  const rate = await consume(`coupon-check:${user ? `user:${user.id}` : `ip:${await callerIp()}`}`, LIMITS.quote);
  if (!rate.allowed) return NextResponse.json(RATE_LIMITED, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 });
  }

  const quote = await buildQuote({
    lines: parsed.data.lines,
    couponCode: parsed.data.code,
    shopper: user ? { userId: user.id } : undefined,
  });

  if (quote.coupon) return NextResponse.json({ ok: true, coupon: quote.coupon });

  const issue = quote.issues.find((entry) => entry.code === 'coupon_invalid');
  return NextResponse.json({ ok: false, reason: issue?.message ?? 'That code cannot be used on this cart.' });
}
