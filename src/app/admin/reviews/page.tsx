import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ExternalLink, MessageSquareReply, Star, ThumbsUp } from 'lucide-react';
import { moderateReviewAction, replyToReviewAction } from '@/lib/admin/service-actions';
import {
  REVIEW_STATUSES,
  reviewStats,
  reviewsForModeration,
  type ReviewStatus,
} from '@/lib/reviews/reviews';
import { productPath } from '@/lib/routes';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice, ServiceNav } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reviews',
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

const TAB_LABEL: Record<ReviewStatus | 'all', string> = {
  pending: 'Waiting',
  published: 'Published',
  hidden: 'Hidden',
  all: 'All',
};

const ACTION_LABEL: Record<ReviewStatus, string> = {
  published: 'Publish',
  hidden: 'Hide',
  pending: 'Back to waiting',
};

const FIELD = 'h-10 rounded-md border border-input bg-card px-3 text-sm';

type Params = {
  status?: string;
  rating?: string;
  q?: string;
  unreplied?: string;
  offset?: string;
  notice?: string;
};

/**
 * The review desk: what is waiting, what shoppers see, and the public reply.
 *
 * Filters live in the URL like the order console, and every action returns to
 * the same filtered page (`back`), so a queue can be worked through without
 * losing one's place.
 */
export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const search = await searchParams;
  const tab: ReviewStatus | 'all' =
    search.status === 'all'
      ? 'all'
      : (REVIEW_STATUSES.find((s) => s === search.status) ?? 'pending');
  const rating = [1, 2, 3, 4, 5].find((n) => String(n) === search.rating);
  const q = search.q?.trim().slice(0, 100) || undefined;
  const unreplied = search.unreplied === '1';
  const parsedOffset = Number.parseInt(search.offset ?? '0', 10);
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const [stats, { reviews, total }] = await Promise.all([
    reviewStats(),
    reviewsForModeration({
      status: tab === 'all' ? undefined : tab,
      rating,
      search: q,
      unreplied,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  /** This view's URL with `changes` applied; any change but paging goes to page 1. */
  const href = (
    changes: Partial<
      Record<'status' | 'rating' | 'q' | 'unreplied' | 'offset', string | undefined>
    >,
  ) => {
    const next = {
      status: tab === 'pending' ? undefined : tab,
      rating: rating ? String(rating) : undefined,
      q,
      unreplied: unreplied ? '1' : undefined,
      offset: undefined as string | undefined,
      ...changes,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    const query = params.toString();
    return query ? `/admin/reviews?${query}` : '/admin/reviews';
  };
  const back = href({ offset: offset > 0 ? String(offset) : undefined });
  const counts: Record<ReviewStatus | 'all', number> = {
    ...stats.byStatus,
    all: stats.byStatus.pending + stats.byStatus.published + stats.byStatus.hidden,
  };
  const published = stats.byStatus.published;

  return (
    <div className="container py-8">
      <ServiceNav
        current="/admin/reviews"
        title="Reviews"
        description="Ratings and reviews from customers who bought the product. Nothing appears on the site until it is published here; publishing updates the product's star rating. A reply is shown publicly under the review."
      />
      <Notice text={search.notice} />

      {/* At a glance */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Waiting for a decision"
          value={String(stats.byStatus.pending)}
          tone={stats.byStatus.pending > 0 ? 'warn' : undefined}
        />
        <Stat
          label="Average shoppers see"
          value={stats.average === null ? '—' : `${stats.average.toFixed(1)} ★`}
          hint={`${published} published review${published === 1 ? '' : 's'}`}
        />
        <Stat label="Published without a reply" value={String(stats.unreplied)} />
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Published ratings</p>
          <ul className="mt-2 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const n = stats.distribution[star - 1];
              const pct = published > 0 ? Math.round((n / published) * 100) : 0;
              return (
                <li key={star}>
                  <Link
                    href={href({ status: 'published', rating: String(star) })}
                    className="flex items-center gap-2 text-xs hover:text-foreground"
                  >
                    <span className="tabular w-6 text-muted-foreground">{star} ★</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="tabular w-6 text-right text-muted-foreground">{n}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Tabs */}
      <nav aria-label="Review status" className="mt-6 flex flex-wrap gap-1.5 text-sm">
        {(['pending', 'published', 'hidden', 'all'] as const).map((status) => (
          <Link
            key={status}
            href={href({ status: status === 'pending' ? undefined : status })}
            aria-current={tab === status ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border px-3 py-1.5',
              tab === status
                ? 'border-primary bg-primary/10 font-medium'
                : 'border-border hover:bg-secondary',
            )}
          >
            {TAB_LABEL[status]}
            <span className="tabular rounded-full bg-secondary px-1.5 text-xs text-muted-foreground">
              {counts[status]}
            </span>
          </Link>
        ))}
      </nav>

      {/* Filters */}
      <form action="/admin/reviews" className="mt-4 flex flex-wrap items-end gap-2">
        {tab !== 'pending' ? <input type="hidden" name="status" value={tab} /> : null}
        <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
          <label htmlFor="r-q" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <input
            id="r-q"
            name="q"
            defaultValue={q}
            placeholder="Product, review text or reviewer"
            className={FIELD}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="r-rating" className="text-xs font-medium text-muted-foreground">
            Rating
          </label>
          <select
            id="r-rating"
            name="rating"
            defaultValue={rating ? String(rating) : ''}
            className={FIELD}
          >
            <option value="">Any</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {n} star{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input type="checkbox" name="unreplied" value="1" defaultChecked={unreplied} />
          No reply yet
        </label>
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Apply
        </Button>
        {rating || q || unreplied ? (
          <Link
            href={href({ rating: undefined, q: undefined, unreplied: undefined })}
            className="px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </Link>
        ) : null}
      </form>

      {reviews.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
          {rating || q || unreplied
            ? 'No reviews match these filters.'
            : `No ${TAB_LABEL[tab].toLowerCase()} reviews.`}
        </p>
      ) : (
        <ul className="mt-6 space-y-4">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-semibold text-foreground">
                  {review.productTitle ?? review.productKey}
                </span>
                {review.productSlug ? (
                  <Link
                    href={`${productPath(review.productSlug)}#reviews`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View on site
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
                <Link
                  href={`/admin/products/${encodeURIComponent(review.productKey)}`}
                  className="text-xs text-muted-foreground underline"
                >
                  Edit product
                </Link>
                {tab === 'all' ? (
                  <span
                    className={cn(
                      'rounded-sm px-1.5 py-0.5 text-2xs font-semibold uppercase',
                      review.status === 'published'
                        ? 'bg-success-soft text-success'
                        : review.status === 'pending'
                          ? 'bg-warning-soft text-warning'
                          : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {TAB_LABEL[review.status]}
                  </span>
                ) : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(review.createdAt)}
                  {review.updatedAt ? ` · edited ${formatDate(review.updatedAt)}` : ''}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span
                  className="inline-flex items-center gap-0.5"
                  aria-label={`${review.rating} stars`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        'h-4 w-4',
                        n <= review.rating ? 'fill-accent text-accent' : 'text-border',
                      )}
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
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-foreground">{review.body}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span>
                  {review.authorName}
                  {review.city ? `, ${review.city}` : ''}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  {review.helpfulCount} found helpful
                </span>
                {review.moderatedBy ? <span>last moderated by {review.moderatedBy}</span> : null}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {REVIEW_STATUSES.filter((s) => s !== review.status).map((status) => (
                  <form key={status} action={moderateReviewAction}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value={status} />
                    <input type="hidden" name="back" value={back} />
                    <Button
                      type="submit"
                      size="sm"
                      variant={status === 'published' ? 'primary' : 'outline'}
                    >
                      {ACTION_LABEL[status]}
                    </Button>
                  </form>
                ))}
              </div>

              {/* Public reply — open by default once one exists, so it can be read. */}
              <details
                className="mt-3 rounded-md border border-border bg-surface"
                open={Boolean(review.reply)}
              >
                <summary className="flex cursor-pointer items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground">
                  <MessageSquareReply className="h-4 w-4 text-primary" />
                  {review.reply ? 'Response from iTarang' : 'Reply publicly'}
                  {review.replyBy ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      by {review.replyBy}
                    </span>
                  ) : null}
                </summary>
                <form action={replyToReviewAction} className="space-y-2 px-3 pb-3">
                  <input type="hidden" name="id" value={review.id} />
                  <input type="hidden" name="back" value={back} />
                  <textarea
                    name="reply"
                    defaultValue={review.reply ?? ''}
                    rows={3}
                    maxLength={2000}
                    placeholder="Thank the customer, or say what we are doing about the problem. Shown under the review on the product page."
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm" variant="outline">
                      {review.reply ? 'Update reply' : 'Post reply'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {review.status === 'published'
                        ? 'Visible on the product page straight away.'
                        : 'Shown once the review is published.'}
                      {review.reply ? ' Clear the text and save to remove it.' : ''}
                    </span>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-3">
          <p className="tabular text-sm text-muted-foreground">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {offset > 0 ? (
              <Link
                href={href({
                  offset: offset - PAGE_SIZE > 0 ? String(offset - PAGE_SIZE) : undefined,
                })}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
              >
                Previous
              </Link>
            ) : null}
            {offset + PAGE_SIZE < total ? (
              <Link
                href={href({ offset: String(offset + PAGE_SIZE) })}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
              >
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        tone === 'warn' ? 'border-warning/40' : 'border-border',
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'tabular mt-1 font-display text-2xl font-bold',
          tone === 'warn' ? 'text-warning' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
