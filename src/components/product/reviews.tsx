'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BadgeCheck, Camera, MapPin, MessageSquarePlus, Store, ThumbsUp } from 'lucide-react';
import { toggleHelpfulAction } from '@/lib/reviews/review-actions';
import type { RatingSummary, Review } from '@/lib/commerce/types';
import { Rating } from '@/components/ui/rating';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { formatDate } from '@/lib/utils';
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
  layout = 'wide',
  writeSlot,
}: {
  summary: RatingSummary | null;
  reviews: Review[];
  productTitle: string;
  /** The "write a review" control, supplied by the page. */
  writeSlot?: React.ReactNode;
  /**
   * `'column'` stacks the distribution above the list.
   *
   * The side-by-side split needs roughly full page width; inside the product
   * page's buy column it squeezes the star bars and the sort control into
   * something unreadable. Tailwind's breakpoints answer the *viewport*, not
   * the container, so the caller has to say which it is.
   */
  layout?: 'wide' | 'column';
}) {
  const [sort, setSort] = React.useState<SortId>('helpful');
  const [starFilter, setStarFilter] = React.useState<number | null>(null);
  const [photosOnly, setPhotosOnly] = React.useState(false);
  const [visible, setVisible] = React.useState(4);
  // Votes cast in this visit: the page is static, so it cannot know earlier
  // ones. The server holds the real tally and answers each click with it.
  const [votes, setVotes] = React.useState<Record<string, { count: number; voted: boolean }>>({});
  const [voteNote, setVoteNote] = React.useState<{
    id: string;
    message: string;
    signin: boolean;
  } | null>(null);
  const [voting, setVoting] = React.useState<string | null>(null);
  const pathname = usePathname();
  // No review can carry photos yet; a filter that never matches is a dead end.
  const anyPhotos = reviews.some((r) => r.hasPhotos);

  async function vote(id: string) {
    setVoting(id);
    setVoteNote(null);
    try {
      const result = await toggleHelpfulAction(id);
      if (result.ok)
        setVotes((v) => ({
          ...v,
          [id]: { count: result.count, voted: result.voted },
        }));
      else
        setVoteNote({
          id,
          message: result.message,
          signin: result.reason === 'signin',
        });
    } catch {
      setVoteNote({
        id,
        message: 'We could not record your vote. Please try again.',
        signin: false,
      });
    } finally {
      setVoting(null);
    }
  }

  const helpfulOf = (review: Review) => votes[review.id]?.count ?? review.helpfulCount;

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
          return b.helpfulCount - a.helpfulCount || b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [reviews, sort, starFilter, photosOnly]);

  if (!summary || reviews.length === 0) {
    return (
      <div className="space-y-4">
        <StateBlock
          icon={<MessageSquarePlus className="h-6 w-6" />}
          title="No reviews yet"
          description={`${productTitle} has not been reviewed yet. Only customers who bought it can review it, so be the first.`}
        />
        {writeSlot ? <div className="mx-auto max-w-md">{writeSlot}</div> : null}
      </div>
    );
  }

  const total = summary.count;

  return (
    <div className={cn('grid gap-8', layout === 'wide' && 'lg:grid-cols-12')}>
      {/* Summary + distribution */}
      <div className={cn(layout === 'wide' && 'lg:col-span-4')}>
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
                        className={cn(
                          'block h-full rounded-full',
                          active ? 'bg-primary' : 'bg-accent',
                        )}
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

          {writeSlot ? <div className="mt-5">{writeSlot}</div> : null}
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Verified buyers only — we do not accept unattached reviews.
          </p>
        </div>
      </div>

      {/* List */}
      <div className={cn(layout === 'wide' && 'lg:col-span-8')}>
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
            {anyPhotos ? (
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
            ) : null}
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
                const hasVoted = votes[review.id]?.voted ?? false;
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
                        onClick={() => void vote(review.id)}
                        disabled={voting === review.id}
                        aria-pressed={hasVoted}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 transition-colors hover:bg-secondary',
                          hasVoted && 'font-semibold text-accent-600',
                        )}
                      >
                        <ThumbsUp className={cn('h-3.5 w-3.5', hasVoted && 'fill-current')} />
                        Helpful ({helpfulOf(review)})
                      </button>
                      {voteNote?.id === review.id ? (
                        <span role="status" className="text-destructive">
                          {voteNote.message}{' '}
                          {voteNote.signin ? (
                            <Link
                              href={`/login?next=${encodeURIComponent(`${pathname}#reviews`)}`}
                              className="underline"
                            >
                              Sign in
                            </Link>
                          ) : null}
                        </span>
                      ) : null}
                    </div>

                    {review.reply ? (
                      <div className="mt-3 rounded-md border-l-2 border-primary bg-surface px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Store className="h-3.5 w-3.5 text-primary" />
                          Response from iTarang
                          <span className="font-normal text-muted-foreground">
                            · {formatDate(review.reply.at)}
                          </span>
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                          {review.reply.body}
                        </p>
                      </div>
                    ) : null}
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
