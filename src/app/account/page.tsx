import type { Metadata } from 'next';
import { Suspense } from 'react';
import { bestSellers } from '@/lib/catalog/collections';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
import { AccountBody } from '@/components/account/account-body';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your account',
  description: 'Saved products, orders, addresses and registered warranties.',
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await currentUser();
  const user = session
    ? {
        email: session.email,
        fullName: session.fullName,
        verified: session.emailVerifiedAt !== null,
      }
    : null;

  // Only ever this account's own orders — the repository filters on user_id in
  // SQL, so there is no moment at which somebody else's order is in hand.
  const history = session
    ? (await orders().listOrdersForUser(session.id, 20)).orders.map((order) => ({
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.amounts.total,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        placedAt: order.createdAt,
      }))
    : [];

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Your account' }]} />
          <h1 className="heading-1 mt-3">Your account</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Saved products, order tracking and your registered warranties.
          </p>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <AccountBody suggestions={await bestSellers(6)} user={user} orders={history} />
        </Suspense>
      </div>
    </>
  );
}
