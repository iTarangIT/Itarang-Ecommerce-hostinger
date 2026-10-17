import type { Metadata } from 'next';
import { catalog } from '@/lib/commerce';
import { biggestDiscounts } from '@/lib/catalog/collections';
import { COUPONS, COUPONS_ENABLED } from '@/lib/offers/coupons';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { SectionHeader } from '@/components/ui/section';
import { ProductRail } from '@/components/merch/product-rail';
import { OffersStrip } from '@/components/merch/offers-strip';
import { CouponCard } from '@/components/merch/coupon-card';

export const metadata: Metadata = {
  title: 'Offers',
  description:
    'WELCOME1000 and WELCOME2000 coupon codes, ₹200 off on UPI payments and free delivery on iTarang lithium batteries.',
  alternates: { canonical: '/offers' },
};

/**
 * Terms, minus the ones for a feature that is switched off.
 *
 * The coupon clauses are dropped while `COUPONS_ENABLED` is false: a terms list
 * that explains how coupons stack, on a page that offers none, reads as an
 * offer we are quietly withholding. There are no bank-card offers and no
 * no-cost EMI; the business offers neither online, so neither is described.
 */
const TERMS = [
  {
    id: 'upi',
    title: 'UPI discount',
    body: '₹200 off the order total when you choose UPI at checkout. The payment window then opens on UPI only. It applies once per order, can be combined with a coupon code, and is not available on cash on delivery.',
  },
  {
    id: 'coupons',
    title: 'Coupon codes',
    body: 'WELCOME1000 takes ₹1,000 off when your cart includes a home inverter battery. WELCOME2000 takes ₹2,000 off when your cart includes a 3-wheeler or e-rickshaw battery. One coupon per order, and each code can be used once per customer.',
  },
  {
    id: 'emi',
    title: 'EMI',
    body: 'Card EMI is offered by the payment gateway (Razorpay) at the payment step, on your card issuer’s terms. Interest and any processing fee are set by the issuer and shown before you confirm. This is not no-cost EMI.',
  },
  {
    id: 'delivery',
    title: 'Delivery',
    body: 'Standard delivery is free on orders above ₹4,999 after discounts. Below that a flat delivery charge applies and is shown in the cart before payment. Batteries ship crated at no extra charge.',
  },
].filter((term) => COUPONS_ENABLED || term.id !== 'coupons');

export default async function OffersPage() {
  const [offers, deals] = await Promise.all([catalog().listOffers(), biggestDiscounts(8)]);

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Offers' }]} />
          <h1 className="heading-1 mt-3 text-balance">
            {COUPONS_ENABLED ? 'Offers and coupon codes' : 'Offers'}
          </h1>
          <p className="mt-3 max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Payment savings apply automatically when you choose the matching method.
            {COUPONS_ENABLED ? ' Coupon codes are entered in the cart.' : ''} Every offer states its
            own condition — nothing here hides behind an unexplained asterisk.
          </p>
        </div>
      </div>

      {/* Codes are only advertised while they can actually be redeemed.
          `COUPONS_ENABLED` is off, so printing four codes the cart would refuse
          would be an offer we do not honour — worse than showing none. */}
      {COUPONS_ENABLED ? (
        <div className="container section">
          <SectionHeader
            eyebrow="Coupon codes"
            title="Codes you can use right now"
            description="Enter the code in your cart before checkout. One coupon per order."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {COUPONS.map((coupon) => (
              <li key={coupon.code}>
                <CouponCard coupon={coupon} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

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
        </div>
      </section>
    </>
  );
}
