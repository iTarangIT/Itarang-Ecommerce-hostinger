import { Info, RotateCcw, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The service promises, as an icon row under the delivery date.
 *
 * Three or four short claims, each with the small info marker a retail page
 * uses to carry the condition without spending a line on it — the full detail
 * is the `title`, so it is available on hover and to a screen reader without
 * crowding the column.
 *
 * **Every tile is gated on a value the product states.** No stated return
 * window means no returns tile; `installationIncluded: false` means no
 * installation tile. Nothing here is unconditional.
 *
 * It used to open with two tiles that were: "Free Delivery above ₹4,999" and
 * "Cash On Delivery — available on eligible orders and pincodes". Neither is a
 * value any product carries, no delivery policy exists anywhere in the
 * catalogue, and checkout is not open — so both printed a promise on all eight
 * product pages that nothing could keep. They are gone rather than reworded,
 * because what is missing is a policy, not a sentence.
 *
 * With today's catalogue that leaves nothing to show on any product and the
 * component renders nothing at all. That is the right number of service
 * promises to make when none is documented.
 */
export function ServiceStrip({
  installationIncluded,
  returnWindowDays,
}: {
  installationIncluded: boolean;
  returnWindowDays?: number;
}) {
  const promises = [
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

  // Nothing documented, nothing rendered — not an empty bordered strip with a
  // divider running down to nothing.
  if (promises.length === 0) return null;

  // One column per promise. A fixed grid leaves a thinly enriched product with
  // an empty cell and a divider running down to nothing.
  const columns = { 1: 'grid-cols-1', 2: 'grid-cols-2' }[promises.length];

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
