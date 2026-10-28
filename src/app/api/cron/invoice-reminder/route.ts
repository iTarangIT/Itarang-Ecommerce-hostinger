import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { mailerIsLive, sendMail } from '@/lib/email/mailer';
import { invoiceReminderMessage } from '@/lib/email/templates';
import { listUninvoicedOrders } from '@/lib/orders/invoices';

export const dynamic = 'force-dynamic';

/**
 * Daily reminder: paid orders older than 24 hours with no invoice (R-08).
 *
 * Called once a day by the VPS timer (`scripts/vps-setup.sh`) with
 * `Authorization: Bearer $CRON_SECRET`. Without `CRON_SECRET` the route does
 * not exist (404), so it can never run unauthenticated by accident. Sends
 * nothing when every paid order has its invoice.
 */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  if (!bearerMatches(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const pending = await listUninvoicedOrders(24);
  if (pending.length === 0) return NextResponse.json({ ok: true, pending: 0, sent: 0 });

  if (!mailerIsLive()) {
    console.warn(`[cron] ${pending.length} orders await an invoice, but email is not configured`);
    return NextResponse.json({ ok: false, pending: pending.length, sent: 0, reason: 'mailer_off' });
  }

  const recipients = env().ORDER_ALERT_EMAILS;
  await Promise.all(recipients.map((to) => sendMail(invoiceReminderMessage(to, pending))));
  return NextResponse.json({ ok: true, pending: pending.length, sent: recipients.length });
}

function bearerMatches(header: string | null, secret: string): boolean {
  const supplied = Buffer.from(header?.replace(/^Bearer\s+/i, '') ?? '');
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
