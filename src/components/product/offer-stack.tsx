import Link from 'next/link';
import { BadgePercent, CreditCard, Layers, Smartphone, Tag, Truck } from 'lucide-react';
import type { Offer, OfferKind } from '@/lib/commerce/types';

const ICONS: Record<OfferKind, typeof Tag> = {
  bank: CreditCard,
  upi: Smartphone,
  emi: BadgePercent,
  coupon: Tag,
  shipping: Truck,
  bundle: Layers,
};

/**
 * PDP offer stack.
 *
 * Every offer states its own condition inline — no "T&C apply" without saying
 * what the terms are.
 */
export function OfferStack({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;

  return (
    <section aria-labelledby="offers-heading" className="rounded-lg border border-border bg-card">
      <h2
        id="offers-heading"
        className="border-b border-border px-4 py-3 font-display text-sm font-semibold text-foreground"
      >
        Available offers
      </h2>
      <ul className="divide-y divide-border">
        {offers.slice(0, 4).map((offer) => {
          const Icon = ICONS[offer.kind];
          return (
            <li key={offer.id} className="flex gap-3 px-4 py-3">
              <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent-600" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-foreground">
                  {offer.title}
                  {offer.code ? (
                    <span className="tabular ml-2 rounded-sm border border-dashed border-accent/50 bg-accent-50 px-1.5 py-0.5 text-xs font-bold text-accent-600">
                      {offer.code}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {offer.detail}
                  {offer.termsUrl ? (
                    <>
                      {' '}
                      <Link
                        href={offer.termsUrl}
                        className="font-medium text-primary underline-offset-4 hover:text-accent-600 hover:underline"
                      >
                        Terms
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
