import { Info, RotateCcw, Truck, Wallet, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The service promises, as an icon row under the delivery date.
 *
 * Three or four short claims, each with the small info marker a retail page
 * uses to carry the condition without spending a line on it — the full detail
 * is the `title`, so it is available on hover and to a screen reader without
 * crowding the column.
 *
 * Every claim is documented policy (see `TRUST_ITEMS` in `lib/site.ts` and
 * `/support/faq`). A promise the catalogue does not state is dropped rather
 * than softened: no stated return window means no returns tile.
 */
export function ServiceStrip({
  installationIncluded,
  returnWindowDays,
}: {
  installationIncluded: boolean;
  returnWindowDays?: number;
}) {
  const promises = [
    {
      icon: Truck,
      label: 'Free Delivery\nabove ₹4,999',
      detail: 'Standard delivery is free on orders above ₹4,999. Batteries ship crated.',
    },
    {
      icon: Wallet,
      label: 'Cash On\nDelivery',
      detail: 'Available on eligible orders and pincodes. Check yours above.',
    },
    installationIncluded
      ? {
          icon: Wrench,
          label: 'Certified\nInstallation',
          detail: 'A certified technician commissions the system and runs a load test.',
        }
      : null,
    returnWindowDays
      ? {
          icon: RotateCcw,
          label: `Free Returns\nWithin ${returnWindowDays} Days`,
          detail: `Unused products in their original packing, returned within ${returnWindowDays} days of delivery.`,
        }
      : null,
  ].filter((promise): promise is NonNullable<typeof promise> => promise !== null);

  // One column per promise. A fixed three-column grid leaves a thinly enriched
  // product with an empty cell and a divider running down to nothing.
  const columns = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[promises.length];

  return (
    <ul className={cn('grid divide-x divide-border border-b border-border py-4', columns)}>
      {promises.map((promise) => (
        <li key={promise.label} className="relative px-2 text-center">
          <promise.icon className="mx-auto h-6 w-6 text-foreground" strokeWidth={1.5} />
          <p className="mt-1.5 whitespace-pre-line text-2xs leading-tight text-muted-foreground">
            {promise.label}
          </p>
          {/* The condition, carried by the marker rather than by a line of its
              own — available on hover and to assistive tech either way. */}
          <span
            title={promise.detail}
            aria-label={promise.detail}
            role="note"
            className="absolute right-1.5 top-0 text-muted-foreground"
          >
            <Info className="h-3 w-3" />
          </span>
        </li>
      ))}
    </ul>
  );
}
