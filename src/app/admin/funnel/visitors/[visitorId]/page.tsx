import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, UserSearch } from 'lucide-react';
import { anonymousVisitorDetail, shortVisitor } from '@/lib/admin/funnel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Anonymous visitor',
  robots: { index: false, follow: false },
};

/**
 * One anonymous visitor's journey.
 *
 * Authorization is inherited from `admin/layout.tsx`. Behaviour only: the
 * timeline carries an event, a product id and a session, and deliberately does
 * not name the account this visitor may since have become. That question has its
 * own screen — `/admin/customers/[userId]` — where the identity is the point and
 * the boundary is explicit. Answering it here would quietly turn a behavioural
 * record into a personal one.
 *
 * `session_id` is shown because it is the only way to see where one visit ended
 * and the next began, which is the reason to read a single visitor at all.
 */

const IST_DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

const KIND_LABELS: Record<string, string> = {
  visit: 'Visited the site',
  product_view: 'Viewed a product',
  buy_now: 'Buy Now',
  add_to_cart: 'Added to cart',
  checkout_intent: 'Reached the login wall',
  begin_checkout: 'Started checkout',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AnonymousVisitorPage({
  params,
}: {
  params: Promise<{ visitorId: string }>;
}) {
  const { visitorId } = await params;

  // Validated before it reaches the query: `visitor_id` is a uuid column, and a
  // malformed cast would be an error rather than an empty result.
  if (!UUID.test(visitorId)) notFound();

  const visitor = await anonymousVisitorDetail(visitorId);
  if (!visitor) notFound();

  return (
    <div className="container py-8">
      <Link
        href="/admin/funnel/visitors"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Anonymous visitors
      </Link>

      <h1 className="heading-2 mt-4 flex items-center gap-2">
        <UserSearch className="h-5 w-5 text-accent-600" />
        Visitor {shortVisitor(visitor.visitorId)}…
      </h1>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Sessions</dt>
          <dd className="tabular mt-1 font-display text-2xl font-bold text-foreground">
            {visitor.sessions}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Events</dt>
          <dd className="tabular mt-1 font-display text-2xl font-bold text-foreground">
            {visitor.timeline.length}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Registered</dt>
          <dd className="mt-1 font-display text-2xl font-bold text-foreground">
            {visitor.converted ? 'Yes' : 'Not yet'}
          </dd>
        </div>
      </dl>

      {visitor.converted ? (
        <p className="mt-3 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          This browser now belongs to an account. The customer it belongs to is deliberately not
          named here — this page records behaviour, not identity. Their full history, including this
          browsing, is on their customer page.
        </p>
      ) : null}

      <h2 className="heading-3 mt-8">Timeline</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">Newest first, across every session.</p>

      <div className="mt-3 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">When</th>
              <th scope="col" className="px-4 py-3 font-semibold">Activity</th>
              <th scope="col" className="px-4 py-3 font-semibold">Product</th>
              <th scope="col" className="px-4 py-3 font-semibold">Session</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {visitor.timeline.map((entry, index) => (
              <tr key={`${entry.at}-${entry.kind}-${index}`}>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {IST_DATETIME.format(new Date(entry.at))}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {KIND_LABELS[entry.kind] ?? entry.kind}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{entry.detail || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {shortVisitor(entry.sessionId)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
