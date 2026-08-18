import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { CheckoutFlow } from '@/components/checkout/checkout-flow';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your iTarang order.',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
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
        <CheckoutFlow />
      </div>
    </>
  );
}
