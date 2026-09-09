import Link from 'next/link';
import { ArrowRight, BadgePercent, CreditCard, Smartphone, Tag, Truck, Layers } from 'lucide-react';
import type { Offer, OfferKind } from '@/lib/commerce/types';
import { COUPONS_ENABLED } from '@/lib/offers/coupons';
import { SectionHeader } from '@/components/ui/section';

const ICONS: Record<OfferKind, typeof Tag> = {
  bank: CreditCard,
  upi: Smartphone,
  emi: BadgePercent,
  coupon: Tag,
  shipping: Truck,
  bundle: Layers,
};

/**
 * Filtered here rather than at each of the two call sites.
 *
 * A `coupon` offer's whole content is a code to type into the cart, and the
 * cart refuses every code while `COUPONS_ENABLED` is false. One filter in the
 * component means neither the home page nor the offers page can advertise one
 * by forgetting.
 */
export function OffersStrip({ offers }: { offers: Offer[] }) {
  const shown = COUPONS_ENABLED ? offers : offers.filter((offer) => offer.kind !== 'coupon');

  if (shown.length === 0) return null;

  return (
    <section className="container section-tight">
      <SectionHeader
        eyebrow="Ways to save"
        title="Offers running now"
        description={
          COUPONS_ENABLED
            ? 'Bank, UPI and EMI savings apply automatically at checkout. Coupon codes are entered in the cart.'
            : 'Bank, UPI and EMI savings apply automatically at checkout.'
        }
        action={{ label: 'All offers and terms', href: '/offers' }}
      />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shown.slice(0, 6).map((offer) => {
          const Icon = ICONS[offer.kind];
          return (
            <li
              key={offer.id}
              className="flex gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent/40"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent-50 text-accent-600">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{offer.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{offer.detail}</p>
                {offer.code ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs">
                    <span className="tabular rounded-sm border border-dashed border-accent/50 bg-accent-50 px-2 py-1 font-bold tracking-wide text-accent-600">
                      {offer.code}
                    </span>
                  </p>
                ) : null}
                {offer.termsUrl ? (
                  <Link
                    href={offer.termsUrl}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-4 hover:text-accent-600 hover:underline"
                  >
                    Terms
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
