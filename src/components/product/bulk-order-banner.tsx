import { Boxes, Headset } from 'lucide-react';
import { SITE } from '@/lib/site';
import { ButtonLink } from '@/components/ui/button';

/**
 * Bulk enquiry band.
 *
 * A builder kitting out ten flats and a shopper buying one battery want
 * different things from the same page, and everything above this serves the
 * second. This gives the first a visible exit rather than leaving them to hunt
 * through the footer for a contact address.
 *
 * The artwork is an icon pair rather than an illustration: Phase 1 has no
 * commissioned imagery, and generic stock art would misrepresent a support
 * desk we describe in specific terms.
 */
export function BulkOrderBanner({ productTitle }: { productTitle: string }) {
  const subject = encodeURIComponent(`Bulk enquiry: ${productTitle}`);

  return (
    <div className="flex items-center gap-4 overflow-hidden rounded-lg border border-border bg-surface p-4">
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-sm font-semibold text-foreground">
          Need more than 10 items?
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Get dedicated support, project pricing and one point of contact for delivery and
          installation.
        </p>
        <ButtonLink
          href={`mailto:${SITE.email}?subject=${subject}`}
          variant="outline"
          size="sm"
          className="mt-3"
        >
          Enquire Now
        </ButtonLink>
      </div>

      <div
        aria-hidden="true"
        className="relative hidden h-24 w-28 shrink-0 place-items-center rounded-md bg-accent-50 xs:grid"
      >
        <Boxes className="h-12 w-12 text-accent-600" strokeWidth={1.25} />
        <Headset className="absolute bottom-2 right-2 h-7 w-7 text-primary" strokeWidth={1.5} />
      </div>
    </div>
  );
}
