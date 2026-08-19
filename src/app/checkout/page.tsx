import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { paymentProvider } from '@/lib/payments';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { CheckoutFlow } from '@/components/checkout/checkout-flow';

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
