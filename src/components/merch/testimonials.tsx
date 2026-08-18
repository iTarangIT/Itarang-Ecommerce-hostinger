import { BadgeCheck, MapPin } from 'lucide-react';
import type { Review } from '@/lib/commerce/types';
import { Rating } from '@/components/ui/rating';
import { SectionHeader } from '@/components/ui/section';
import { formatDate } from '@/lib/utils';

/**
 * Customer reviews on the homepage.
 *
 * Reviewers are shown by city and verification state only — the review data
 * carries no names or personal details.
 */
export function Testimonials({
  reviews,
  productTitles,
}: {
  reviews: Review[];
  productTitles: Record<string, string>;
}) {
  if (reviews.length === 0) return null;

  return (
    <section className="container section">
      <SectionHeader
        eyebrow="From verified buyers"
        title="What owners say after living with it"
        description="Every review here is attached to a real order. We publish the critical ones too."
      />
      <ul className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="flex flex-col rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-card"
          >
            <div className="flex items-center justify-between gap-2">
              <Rating value={review.rating} size="md" />
              {review.verifiedPurchase ? (
                <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-success">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified
                </span>
              ) : null}
            </div>
            <p className="mt-3 font-display text-sm font-semibold text-foreground">
              {review.title}
            </p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
              {review.body}
            </p>
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {review.city} · {formatDate(review.createdAt)}
              </p>
              <p className="mt-1 truncate font-medium text-foreground">
                {productTitles[review.productId] ?? ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
