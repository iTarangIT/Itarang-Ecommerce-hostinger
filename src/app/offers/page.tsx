import type { Metadata } from 'next';
import { catalog } from '@/lib/commerce';
import { biggestDiscounts } from '@/lib/catalog/collections';
import { COUPONS } from '@/lib/offers/coupons';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { SectionHeader } from '@/components/ui/section';
import { ProductRail } from '@/components/merch/product-rail';
import { OffersStrip } from '@/components/merch/offers-strip';
import { CouponCard } from '@/components/merch/coupon-card';

export const metadata: Metadata = {
  title: 'Offers',
  description:
    'Bank, UPI and EMI savings, coupon codes and delivery offers on iTarang inverters, batteries, UPS systems and combos.',
  alternates: { canonical: '/offers' },
};

const TERMS = [
  {
    id: 'upi',
    title: 'UPI discount',
    body: 'The UPI discount is applied to the order total at checkout when a UPI payment method is selected. It cannot be combined with a bank card instant discount on the same transaction.',
  },
  {
    id: 'emi',
    title: 'No-cost EMI',
    body: 'No-cost EMI means the instalment total equals the product price — the interest component is discounted upfront. Availability, tenure and any processing fee depend on your card issuer and are shown before you confirm the order.',
  },
  {
    id: 'bank',
    title: 'Bank card instant discount',
    body: 'Instant discounts apply to eligible cards on qualifying transactions above the stated minimum, subject to a per-card monthly cap. Eligibility is determined by the issuing bank at the time of payment.',
  },
  {
    id: 'delivery',
    title: 'Delivery',
    body: 'Standard delivery is free on orders above ₹4,999 after discounts. Below that a flat delivery charge applies and is shown in the cart before payment. Batteries ship crated at no extra charge.',
  },
  {
    id: 'coupons',
    title: 'Coupon codes',
    body: 'One coupon per order. Coupons apply only to the product categories stated on the code, and do not stack with bank card instant discounts. Codes may be withdrawn at any time.',
  },
];

export default async function OffersPage() {
  const [offers, deals] = await Promise.all([catalog().listOffers(), biggestDiscounts(8)]);

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Offers' }]} />
          <h1 className="heading-1 mt-3 text-balance">Offers and coupon codes</h1>
          <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Payment savings apply automatically when you choose the matching method. Coupon codes
            are entered in the cart. Every offer states its own condition — nothing here hides
            behind an unexplained asterisk.
          </p>
        </div>
      </div>

      <div className="container section">
        <SectionHeader
          eyebrow="Coupon codes"
          title="Codes you can use right now"
          description="Enter the code in your cart before checkout. One coupon per order."
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {COUPONS.map((coupon) => (
            <li key={coupon.code}>
              <CouponCard coupon={coupon} />
            </li>
          ))}
        </ul>
      </div>

      <OffersStrip offers={offers} />

      <div className="container section-tight">
        <ProductRail
          products={deals}
          eyebrow="Biggest reductions"
          title="Largest discounts in the range"
          description="Sorted by percentage off MRP across every category."
          action={{ label: 'See all deals', href: '/search?sort=discount-desc' }}
        />
      </div>

      <section id="terms" className="scroll-mt-28 border-t border-border bg-surface">
        <div className="container section">
          <SectionHeader
            eyebrow="The small print"
            title="Offer terms"
            description="Written out in full, because a discount you cannot actually claim is not a discount."
          />
          <dl className="grid gap-4 lg:grid-cols-2">
            {TERMS.map((term) => (
              <div
                key={term.id}
                id={term.id}
                className="scroll-mt-28 rounded-lg border border-border bg-card p-5"
              >
                <dt className="font-display text-sm font-semibold text-foreground">{term.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">{term.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 max-w-3xl text-xs text-muted-foreground">
            Offer values shown on this page are development placeholders and must be confirmed
            against signed commercial terms before publication.
          </p>
        </div>
      </section>
    </>
  );
}
