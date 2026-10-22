import Link from 'next/link';
import { MessageSquareReply, Star, ThumbsUp } from 'lucide-react';
import type { OwnReview } from '@/lib/reviews/reviews';
import type { ReviewStatus } from '@/lib/reviews/reviews';
import { Rating } from '@/components/ui/rating';
import { StateBlock } from '@/components/ui/states';
import { productPath } from '@/lib/routes';
import { cn, formatDate } from '@/lib/utils';

const STATUS: Record<ReviewStatus, { label: string; tone: string; note: string }> = {
  pending: {
    label: 'Being checked',
    tone: 'bg-warning-soft text-warning',
    note: 'Our team checks every review before it appears.',
  },
  published: { label: 'Live', tone: 'bg-success-soft text-success', note: '' },
  hidden: {
    label: 'Not shown',
    tone: 'bg-secondary text-muted-foreground',
    note: 'This review is not shown on the product page. Contact support if you think that is a mistake.',
  },
};

/**
 * "Your reviews": every review this account has written, with where it stands
 * and the team's reply. Editing happens on the product page — writing again
 * replaces the earlier review.
 */
export function OwnReviews({ reviews }: { reviews: OwnReview[] }) {
  if (reviews.length === 0) {
    return (
      <StateBlock
        icon={<Star className="h-6 w-6" />}
        title="No reviews yet"
        description="Bought something from us? Open the product page and choose “Write a review” to rate it. Only customers who bought a product can review it."
      />
    );
  }

  return (
    <ul className="space-y-4">
      {reviews.map((review) => {
        const status = STATUS[review.status];
        const href = review.productSlug ? `${productPath(review.productSlug)}#reviews` : null;
        return (
          <li key={review.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {href ? (
                <Link
                  href={href}
                  className="text-sm font-semibold text-foreground hover:text-primary hover:underline"
                >
                  {review.productTitle ?? 'Product'}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-foreground">
                  {review.productTitle ?? 'Product'}
                </span>
              )}
              <span
                className={cn(
                  'rounded-sm px-1.5 py-0.5 text-2xs font-semibold uppercase',
                  status.tone,
                )}
              >
                {status.label}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatDate(review.createdAt)}
                {review.updatedAt ? ` · edited ${formatDate(review.updatedAt)}` : ''}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Rating value={review.rating} size="md" />
              <span className="text-sm font-semibold text-foreground">{review.title}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {review.body}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {review.status === 'published' ? (
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  {review.helpfulCount} {review.helpfulCount === 1 ? 'person' : 'people'} found this
                  helpful
                </span>
              ) : null}
              {status.note ? <span>{status.note}</span> : null}
              {href ? (
                <Link href={href} className="font-medium text-primary hover:underline">
                  Edit review
                </Link>
              ) : null}
            </div>

            {review.reply ? (
              <div className="mt-3 rounded-md border-l-2 border-primary bg-surface px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <MessageSquareReply className="h-3.5 w-3.5 text-primary" />
                  Response from iTarang
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {review.reply}
                </p>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
