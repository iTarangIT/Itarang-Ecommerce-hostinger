import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight, MessageCircle, Package, Phone } from 'lucide-react';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { TrackForm } from '@/components/account/track-form';
import { OrderProgressBar } from '@/components/account/order-progress';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
import { TRACK_STEPS, trackView } from '@/lib/orders/tracking';
import { formatPrice } from '@/lib/catalog/pricing';
import { SITE } from '@/lib/site';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Track your order',
  description: 'See where your iTarang order is, from confirmation to delivery.',
  alternates: { canonical: '/track' },
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const [{ order: initialOrder = '' }, session] = await Promise.all([searchParams, currentUser()]);

  // Signed in: their own orders, newest first — filtered on user_id in SQL with
  // the id from the session, so no one else's order is ever in hand. Each is a
  // one-click track; nothing to type.
  const mine = session
    ? (await orders().listOrdersForUser(session.id, 10)).orders.map((order) => ({
        orderNumber: order.orderNumber,
        placedAt: order.createdAt,
        total: order.amounts.total,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        firstItem: order.items[0]?.title ?? 'Order',
        view: trackView(order.status, order.createdAt),
      }))
    : [];

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Track order' }]} />
          <div className="mt-4 flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-card sm:grid">
              <Package className="h-6 w-6" />
            </span>
            <div>
              <h1 className="heading-1 text-balance">Track your order</h1>
              <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {session
                  ? 'Pick an order below to see where it is, or look one up by its number.'
                  : 'Enter your order number and the mobile number on the order — no account needed.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container grid gap-8 py-8 lg:grid-cols-12 lg:gap-10 lg:py-10">
        <div className="space-y-6 lg:col-span-8">
          {mine.length > 0 ? (
            <section aria-labelledby="your-orders" className="rounded-xl border border-border bg-card p-5 sm:p-6">
              <h2 id="your-orders" className="heading-3">
                Your orders
              </h2>
              <ul className="mt-4 divide-y divide-border">
                {mine.map((order) => (
                  <li key={order.orderNumber}>
                    <Link
                      href={`/track?order=${encodeURIComponent(order.orderNumber)}`}
                      className="group flex items-center gap-4 py-4"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {order.firstItem}
                            {order.itemCount > 1 ? (
                              <span className="font-normal text-muted-foreground">
                                {' '}
                                + {order.itemCount - 1} more
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular text-sm text-muted-foreground">
                            {formatPrice(order.total)}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          <span className="tabular">{order.orderNumber}</span> · {formatDate(order.placedAt)}
                        </span>
                        <span className="mt-2 flex items-center gap-3">
                          <span className="w-28 shrink-0 sm:w-40">
                            <OrderProgressBar view={order.view} />
                          </span>
                          <span className="truncate text-xs font-semibold text-foreground">
                            {order.view.cancelled
                              ? 'Cancelled'
                              : order.view.awaitingPayment
                                ? 'Waiting for payment'
                                : TRACK_STEPS[order.view.currentIndex].label}
                          </span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary sm:flex">
                        Track
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground sm:hidden" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <TrackForm key={initialOrder} initialOrder={initialOrder} signedIn={Boolean(session)} />

          {!session ? (
            <p className="text-sm text-muted-foreground">
              Have an account?{' '}
              <Link
                href={`/login?next=${encodeURIComponent('/track')}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Sign in
              </Link>{' '}
              to see all your orders here without typing anything.
            </p>
          ) : null}
        </div>

        <aside className="space-y-6 lg:col-span-4">
          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="heading-3">How your order moves</h2>
            <ol className="mt-4 space-y-3">
              {TRACK_STEPS.map((step, index) => (
                <li key={step.key} className="flex gap-3">
                  <span className="tabular grid h-6 w-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm">
                    <span className="font-semibold text-foreground">{step.label}</span>
                    <span className="block text-xs text-muted-foreground">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
            <h2 className="heading-3">Need help?</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Can&apos;t find your order number, or it&apos;s running late? We&apos;ll check for you.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={SITE.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
              </a>
              <a
                href={SITE.phoneHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                <Phone className="h-4 w-4" />
                Call {SITE.phone}
              </a>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
