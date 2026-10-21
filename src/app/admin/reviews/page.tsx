import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Star } from 'lucide-react';
import { moderateReviewAction } from '@/lib/admin/service-actions';
import { reviewsForModeration, type ReviewStatus } from '@/lib/reviews/reviews';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice, ServiceNav } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reviews',
  robots: { index: false, follow: false },
};

const TABS: Array<{ status: ReviewStatus; label: string }> = [
  { status: 'pending', label: 'Waiting' },
  { status: 'published', label: 'Published' },
  { status: 'hidden', label: 'Hidden' },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; notice?: string }>;
}) {
  const search = await searchParams;
  const status = TABS.find((tab) => tab.status === search.status)?.status ?? 'pending';
  const reviews = await reviewsForModeration(status);

  return (
    <div className="container py-8">
      <ServiceNav
        current="/admin/reviews"
        title="Reviews"
        description="Reviews from customers who bought the product. Nothing appears on the site until it is published here; publishing updates the product's star rating."
      />
      <Notice text={search.notice} />

      <div className="mt-4 flex gap-1.5 text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/reviews?status=${tab.status}`}
            className={cn(
              'rounded-md border px-3 py-1.5',
              tab.status === status ? 'border-primary bg-primary/10 font-medium' : 'border-border',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
          No {TABS.find((tab) => tab.status === status)?.label.toLowerCase()} reviews.
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-0.5" aria-label={`${review.rating} stars`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn('h-4 w-4', n <= review.rating ? 'fill-accent text-accent' : 'text-border')}
                    />
                  ))}
                </span>
                <span className="font-semibold text-foreground">{review.title}</span>
                {review.verified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-success">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified purchase
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-foreground">{review.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {review.authorName}
                {review.city ? `, ${review.city}` : ''} · product{' '}
                <Link href={`/admin/products/${encodeURIComponent(review.productKey)}`} className="underline">
                  {review.productKey}
                </Link>
                {review.moderatedBy ? ` · last moderated by ${review.moderatedBy}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {TABS.filter((tab) => tab.status !== status).map((tab) => (
                  <form key={tab.status} action={moderateReviewAction}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value={tab.status} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={tab.status === 'published' ? 'primary' : 'outline'}
                    >
                      {tab.status === 'published' ? 'Publish' : tab.status === 'hidden' ? 'Hide' : 'Back to waiting'}
                    </Button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
