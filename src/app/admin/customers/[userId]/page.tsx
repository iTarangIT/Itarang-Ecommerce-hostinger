import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, UserRound } from 'lucide-react';
import { customerDetail } from '@/lib/admin/funnel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Customer activity',
  robots: { index: false, follow: false },
};

/**
 * One customer's journey, newest first.
 *
 * Authorization is inherited from `admin/layout.tsx`. This is the most
 * sensitive screen in the console — it is the only place browsing behaviour and
 * a named person appear together — so it must stay beneath that layout, and no
 * API route exposes the same join.
 *
 * `funnel_events` itself holds no personal data: the name, e-mail and phone
 * below come from `users`, joined at query time. Nothing here is reachable by a
 * customer, and a customer can never see another customer's activity because
 * there is no customer-facing route that reads any of it.
 */

const IST_DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

/** Human labels for the union of browsing events and commerce records. */
const KIND_LABELS: Record<string, string> = {
  visit: 'Visited the site',
  product_view: 'Viewed a product',
  buy_now: 'Clicked Buy Now',
  add_to_cart: 'Added to cart',
  // Only ever appears before this person had an account — /checkout records it
  // for a signed-out visitor and then redirects them to sign in. Seeing it in a
  // customer's timeline is the moment they stopped being anonymous.
  checkout_intent: 'Hit the login wall (anonymous)',
  begin_checkout: 'Reached checkout',
  order_created: 'Placed an order',
  payment_pending: 'Payment started',
  payment_authorized: 'Payment authorised',
  payment_paid: 'Payment captured',
  payment_failed: 'Payment failed',
  payment_refunded: 'Payment refunded',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default async function CustomerActivityPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  // Clamped, not trusted: a hand-edited id must not reach the query as
  // something that could overflow or scan.
  const parsed = Number.parseInt(userId, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) notFound();

  const customer = await customerDetail(parsed);
  if (!customer) notFound();

  return (
    <div className="container py-8">
      <Link
        href="/admin/funnel"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Customer funnel
      </Link>

      <h1 className="heading-2 mt-4 flex items-center gap-2">
        <UserRound className="h-5 w-5 text-accent-600" />
        {customer.fullName || customer.email}
      </h1>

      <dl className="mt-4 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <Row label="Email" value={customer.email} />
        <Row label="Phone" value={customer.phone || '—'} />
        <Row label="Account since" value={IST_DATETIME.format(new Date(customer.createdAt))} />
        <Row label="Events" value={String(customer.timeline.length)} />
      </dl>

      <h2 className="heading-3 mt-8">Activity</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Browsing and commerce interleaved, newest first. Cash on delivery is excluded, matching the
        rest of the console.
      </p>

      {customer.timeline.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
          No recorded activity. Browsing is only visible from the date funnel tracking shipped.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Activity</th>
                <th scope="col" className="px-4 py-3 font-semibold">Detail</th>
                <th scope="col" className="px-4 py-3 font-semibold">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {customer.timeline.map((entry, index) => (
                <tr key={`${entry.at}-${entry.kind}-${index}`}>
                  <td className="px-4 py-3 text-muted-foreground">
                    {IST_DATETIME.format(new Date(entry.at))}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {KIND_LABELS[entry.kind] ?? entry.kind}
                  </td>
                  <td className="tabular px-4 py-3 text-xs text-muted-foreground">
                    {entry.detail || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {entry.orderNumber ? (
                      <Link
                        href={`/admin/orders/${entry.orderNumber}`}
                        className="tabular font-semibold text-primary hover:text-accent-600 hover:underline"
                      >
                        {entry.orderNumber}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
