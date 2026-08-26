import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { paymentProvider } from '@/lib/payments';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { peekVisitor, record } from '@/lib/analytics/events';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your iTarang order.',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Placing an order requires an account. The cart lives in localStorage, so a
  // round trip through /login and back leaves it exactly as it was — the
  // shopper returns to a full cart rather than an empty one.
  const user = await requireUser('/checkout');

  // The funnel's checkout stage, recorded on the server.
  //
  // This page is already `force-dynamic`, so there is no caching to lose, and a
  // server-written event cannot be forged by a browser that never opened the
  // page. That is worth more here than at the earlier stages, because this is
  // the last one before money is involved.
  //
  // `peekVisitor` reads the cookies without minting them — a page render may
  // not write cookies. A shopper arriving here has browsed first and will have
  // them; the rare cold entry simply goes unrecorded rather than being invented.
  const visitor = await peekVisitor();
  if (visitor) {
    await record({
      event: 'begin_checkout',
      visitor: { ...visitor, freshVisitor: false, freshSession: false },
      userId: user.id,
    });
  }

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-5 sm:py-7">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Cart', href: '/cart' },
              { label: 'Checkout' },
            ]}
          />
          <h1 className="heading-1 mt-3">Checkout</h1>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <CheckoutFlow
          account={{ email: user.email, fullName: user.fullName, phone: user.phone }}
          provider={paymentProvider().id}
        />
      </div>
    </>
  );
}
