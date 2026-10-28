import type { Metadata } from 'next';
import { catalog } from '@/lib/commerce';
import { biggestDiscounts } from '@/lib/catalog/collections';
import { COUPONS_ENABLED } from '@/lib/offers/coupons';
import { listSiteCoupons } from '@/lib/offers/campaign-store';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { SectionHeader } from '@/components/ui/section';
import { ProductRail } from '@/components/merch/product-rail';
import { OffersStrip } from '@/components/merch/offers-strip';
import { CouponCard } from '@/components/merch/coupon-card';

export const metadata: Metadata = {
  title: 'Offers',
  description:
    'Current coupon codes and ₹200 off on UPI payments for iTarang lithium batteries.',
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
    // Each code's own terms are printed on its card above; these are the rules
    // every code shares.
    body: 'Each code above states what it applies to and who can use it. One coupon per order; it can be combined with the UPI discount. A code may be limited to a first order, to particular customers or delivery areas, or to a number of uses, and stops working when its campaign ends.',
  },
  {
    id: 'emi',
    title: 'EMI',
    body: 'Card EMI is offered by the payment gateway (Razorpay) at the payment step, on your card issuer’s terms. Interest and any processing fee are set by the issuer and shown before you confirm. This is not no-cost EMI.',
  },
  {
    id: 'delivery',
    title: 'Delivery',
    body: 'Delivery is free on every order. Batteries ship crated at no extra charge.',
  },
].filter((term) => COUPONS_ENABLED || term.id !== 'coupons');

// Campaigns have start and end dates; re-render at least every five minutes.
export const revalidate = 300;

export default async function OffersPage() {
  const [offers, deals, coupons] = await Promise.all([
    catalog().listOffers(),
    biggestDiscounts(8),
    COUPONS_ENABLED ? listSiteCoupons() : Promise.resolve([]),
  ]);

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
      {coupons.length > 0 ? (
        <div className="container section">
          <SectionHeader
            eyebrow="Coupon codes"
            title="Codes you can use right now"
            description="Enter the code in your cart before checkout. One coupon per order."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {coupons.map((coupon) => (
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
