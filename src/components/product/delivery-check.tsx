import { MapPin } from 'lucide-react';
import Link from 'next/link';

/**
 * What we can honestly say about getting a product to somebody's address.
 *
 * **This used to be a pincode checker, and its answers were arithmetic.**
 * `lib/support/serviceability.ts` sums the six digits of the pincode: a
 * checksum divisible by eleven meant "we do not deliver to this pincode yet",
 * `2 + (checksum % 4)` was the number of days, and `checksum % 3 !== 0` decided
 * whether cash on delivery was available. The module says so itself — "nothing
 * here reflects actual iTarang coverage… must be replaced with a real
 * serviceability dataset or courier API before launch".
 *
 * On a development fixture that is a reasonable stand-in. On a live product
 * page it is a fabricated answer to a question a real customer is asking about
 * their own home, and one of its outcomes turns a buyer away from an address we
 * may very well deliver to. Every page also opened with "Reaching your home in
 * 3 – 5 days", which nothing at all backed.
 *
 * So the invented figures are gone and the honest answer takes their place.
 * Coverage, timing and payment options are confirmed by the team, which is
 * true today and stays true until there is a real serviceability dataset.
 *
 * **`lib/support/serviceability.ts` is deliberately untouched.** It is also
 * read by `lib/orders/quote.ts` and the checkout flow, which are out of scope
 * — this change is confined to what the product page shows. Replacing the
 * fixture with real coverage data is recorded as a deferred item; it needs a
 * courier integration and a business decision, not a rewrite of this file.
 */
export function DeliveryCheck({ installationIncluded }: { installationIncluded: boolean }) {
  return (
    <div className="border-y border-border py-4">
      <p className="flex items-start gap-2.5 text-sm text-foreground">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
        <span>
          <span className="font-semibold">Delivery is arranged with you.</span>{' '}
          <span className="text-muted-foreground">
            Tell us your pincode and we will confirm coverage, the timing and what the delivery
            costs before you commit to anything.
          </span>
        </span>
      </p>

      {/* Gated on the product, like every other assurance on this page. No
          product in the catalogue currently sets it, so this does not render. */}
      {installationIncluded ? (
        <p className="mt-2 pl-[1.9rem] text-sm text-muted-foreground">
          Installation is included on this product and booked at a slot you choose.
        </p>
      ) : null}

      <Link
        href="/support"
        className="mt-3 inline-block pl-[1.9rem] text-sm font-semibold text-accent-600 underline-offset-4 hover:underline"
      >
        Check delivery to your pincode
      </Link>
    </div>
  );
}
