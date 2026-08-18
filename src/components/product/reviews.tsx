'use client';

import * as React from 'react';
import { BadgeCheck, Camera, MapPin, MessageSquarePlus, ThumbsUp } from 'lucide-react';
import type { RatingSummary, Review } from '@/lib/commerce/types';
import { Rating } from '@/components/ui/rating';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
import { useUI } from '@/lib/store/ui-provider';
import { cn } from '@/lib/utils';

type SortId = 'recent' | 'helpful' | 'high' | 'low';

const SORTS: Array<{ id: SortId; label: string }> = [
  { id: 'recent', label: 'Most recent' },
  { id: 'helpful', label: 'Most helpful' },
  { id: 'high', label: 'Highest rated' },
  { id: 'low', label: 'Lowest rated' },
];

/**
 * Reviews.
 *
 * Distribution bars double as filters, which is the fastest route to the
 * one-star reviews shoppers actually go looking for.
 */
export function Reviews({
  summary,
  reviews,
  productTitle,
}: {
  summary: RatingSummary | null;
  reviews: Review[];
  productTitle: string;
}) {
  const { toast } = useUI();
  const [sort, setSort] = React.useState<SortId>('helpful');
  const [starFilter, setStarFilter] = React.useState<number | null>(null);
  const [photosOnly, setPhotosOnly] = React.useState(false);
  const [visible, setVisible] = React.useState(4);
  const [voted, setVoted] = React.useState<string[]>([]);

  const filtered = React.useMemo(() => {
    let list = reviews;
    if (starFilter) list = list.filter((r) => Math.round(r.rating) === starFilter);
    if (photosOnly) list = list.filter((r) => r.hasPhotos);

    return [...list].sort((a, b) => {
      switch (sort) {
        case 'recent':
          return b.createdAt.localeCompare(a.createdAt);
        case 'high':
          return b.rating - a.rating;
        case 'low':
          return a.rating - b.rating;
        default:
          return b.helpfulCount - a.helpfulCount;
      }
    });
  }, [reviews, sort, starFilter, photosOnly]);

  if (!summary || reviews.length === 0) {
    return (
      <StateBlock
        icon={<MessageSquarePlus className="h-6 w-6" />}
        title="No reviews yet"
        description={`${productTitle} has not been reviewed yet. Reviews are only published from verified orders, so this fills up as the first systems are installed.`}
      />
    );
  }

  const total = summary.count;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      {/* Summary + distribution */}
      <div className="lg:col-span-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-4">
            <p className="tabular font-display text-4xl font-bold text-foreground">
              {summary.average.toFixed(1)}
            </p>
            <div>
              <Rating value={summary.average} size="lg" />
              <p className="mt-1 text-sm text-muted-foreground">
                {total} verified {total === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          </div>

          <ul className="mt-5 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = summary.distribution[star - 1];
              const percent = total > 0 ? Math.round((count / total) * 100) : 0;
              const active = starFilter === star;
              return (
                <li key={star}>
                  <button
                    type="button"
                    onClick={() => setStarFilter(active ? null : star)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-sm px-1 py-1 transition-colors hover:bg-secondary',
                      active && 'bg-secondary',
                    )}
                  >
                    <span className="tabular w-8 shrink-0 text-left text-xs text-muted-foreground">
                      {star} ★
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-border">
                      <span
                        className={cn('block h-full rounded-full', active ? 'bg-primary' : 'bg-accent')}
                        style={{ width: `${percent}%` }}
                      />
                    </span>
                    <span className="tabular w-10 shrink-0 text-right text-xs text-muted-foreground">
                      {percent}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Button
            variant="outline"
            fullWidth
            className="mt-5"
            onClick={() =>
              toast({
                title: 'Reviews open after delivery',
                description:
                  'Only verified buyers can review, so the form unlocks once your order is delivered.',
                tone: 'info',
              })
            }
          >
            Write a review
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Verified buyers only — we do not accept unattached reviews.
          </p>
        </div>
      </div>

      {/* List */}
      <div className="lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {starFilter ? (
              <button
                type="button"
                onClick={() => setStarFilter(null)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-destructive/40 hover:text-destructive"
              >
                {starFilter} star ✕
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setPhotosOnly((p) => !p)}
              aria-pressed={photosOnly}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                photosOnly
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:border-accent/50',
              )}
            >
              <Camera className="h-3.5 w-3.5" />
              With photos
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortId)}
              className="h-10 cursor-pointer rounded-md border border-input bg-card px-2.5 text-sm font-medium text-foreground"
              aria-label="Sort reviews"
            >
              {SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No reviews match this filter.{' '}
            <button
              type="button"
              onClick={() => {
                setStarFilter(null);
                setPhotosOnly(false);
              }}
              className="font-semibold text-accent-600 underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          </p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {filtered.slice(0, visible).map((review) => {
                const hasVoted = voted.includes(review.id);
                return (
                  <li key={review.id} className="py-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Rating value={review.rating} size="md" />
                      <h3 className="font-display text-sm font-semibold text-foreground">
                        {review.title}
                      </h3>
                      {review.verifiedPurchase ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-success">
                          <BadgeCheck className="h-3.5 w-3.5" /> Verified purchase
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {review.body}
                    </p>

                    {review.hasPhotos ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Camera className="h-3.5 w-3.5" />
                        Photos attached by the reviewer
                      </p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {review.city}
                      </span>
                      <span>{formatDate(review.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setVoted((v) =>
                            v.includes(review.id)
                              ? v.filter((id) => id !== review.id)
                              : [...v, review.id],
                          )
                        }
                        aria-pressed={hasVoted}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 transition-colors hover:bg-secondary',
                          hasVoted && 'font-semibold text-accent-600',
                        )}
                      >
                        <ThumbsUp className={cn('h-3.5 w-3.5', hasVoted && 'fill-current')} />
                        Helpful ({review.helpfulCount + (hasVoted ? 1 : 0)})
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {visible < filtered.length ? (
              <Button
                variant="outline"
                fullWidth
                className="mt-4"
                onClick={() => setVisible((v) => v + 4)}
              >
                Show more reviews ({filtered.length - visible} remaining)
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
