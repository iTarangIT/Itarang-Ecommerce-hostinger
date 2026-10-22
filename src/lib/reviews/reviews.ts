import { query, queryOne } from '@/lib/db/pool';
import type { RatingSummary, Review } from '@/lib/commerce/types';

/**
 * Product reviews: written by signed-in buyers and shown straight away. An
 * administrator can hide one afterwards.
 *
 * Server-only. Two rules shape everything here:
 *
 * - **Buyers' reviews publish on save.** Only verified buyers can write one,
 *   so a review is `published` when saved; only `published` rows reach the
 *   storefront, the rating average or the structured data a search engine
 *   reads. A review the team has hidden stays hidden when it is edited.
 * - **"Verified purchase" means the customer really has it.** A paid order, or
 *   a delivered one (cash on delivery is often marked paid late, or never),
 *   decided when the review is written and stored.
 *
 * The storefront read paths fail soft. The catalogue calls them on every
 * product load, and a database that has not had migration 0021 yet must still
 * serve products — with no ratings, which is the truth for that database. One
 * that has 0021 but not 0022 (votes, replies) falls back to the old query
 * rather than losing every review: the deploy does not run migrations.
 */

export type ReviewStatus = 'pending' | 'published' | 'hidden';

export const REVIEW_STATUSES: ReviewStatus[] = ['pending', 'published', 'hidden'];

export interface ModerationReview {
  id: number;
  productKey: string;
  productTitle: string | null;
  productSlug: string | null;
  authorName: string;
  city: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string | null;
  moderatedBy: string | null;
  helpfulCount: number;
  reply: string | null;
  replyBy: string | null;
}

/** A customer's own review, for /account. */
export interface OwnReview {
  id: number;
  productKey: string;
  productTitle: string | null;
  productSlug: string | null;
  rating: number;
  title: string;
  body: string;
  city: string | null;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string | null;
  helpfulCount: number;
  reply: string | null;
}

interface Row {
  id: number;
  product_key: string;
  author_name: string;
  city: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  status: ReviewStatus;
  created_at: Date;
  updated_at?: Date | null;
  moderated_by: string | null;
  admin_reply?: string | null;
  admin_reply_at?: Date | null;
  admin_reply_by?: string | null;
  helpful_count?: number;
  product_title?: string | null;
  product_slug?: string | null;
}

let warned = false;
function softFail<T>(fallback: T) {
  return (error: unknown): T => {
    if (!warned) {
      warned = true;
      console.warn('[reviews] reviews unavailable (has migration 0021 run?):', (error as Error).message);
    }
    return fallback;
  };
}

/** Run the current query; on a database without migration 0022, the old one. */
async function withLegacy<T>(current: () => Promise<T>, legacy: () => Promise<T>): Promise<T> {
  try {
    return await current();
  } catch (error) {
    console.warn('[reviews] falling back (has migration 0022 run?):', (error as Error).message);
    return legacy();
  }
}

const HELPFUL = `(SELECT count(*)::int FROM product_review_votes v WHERE v.review_id = r.id)`;

function toReview(row: Row): Review {
  return {
    id: String(row.id),
    productId: row.product_key,
    rating: row.rating,
    title: row.title,
    body: row.body,
    // `Review` identifies a reviewer by city and verification only; the first
    // name rides along in `city` when no city was given, so a card is never
    // anonymous to the point of looking invented.
    city: row.city ? `${row.author_name}, ${row.city}` : row.author_name,
    verifiedPurchase: row.verified,
    createdAt: row.created_at.toISOString(),
    helpfulCount: Number(row.helpful_count ?? 0),
    hasPhotos: false,
    reply:
      row.admin_reply && row.admin_reply_at
        ? { body: row.admin_reply, at: row.admin_reply_at.toISOString() }
        : undefined,
  };
}

/** Published reviews for one product, newest first. */
export async function publishedReviews(productKey: string, limit = 100): Promise<Review[]> {
  return withLegacy(
    () =>
      query<Row>(
        `SELECT r.*, ${HELPFUL} AS helpful_count FROM product_reviews r
          WHERE r.product_key = $1 AND r.status = 'published'
          ORDER BY r.created_at DESC LIMIT $2`,
        [productKey, limit],
      ),
    () =>
      query<Row>(
        `SELECT * FROM product_reviews
          WHERE product_key = $1 AND status = 'published'
          ORDER BY created_at DESC LIMIT $2`,
        [productKey, limit],
      ),
  )
    .then((rows) => rows.map(toReview))
    .catch(softFail<Review[]>([]));
}

/** The best recent reviews across the range, for the home page. */
export async function featuredPublishedReviews(limit = 6): Promise<Review[]> {
  return query<Row>(
    `SELECT * FROM product_reviews
      WHERE status = 'published' AND rating >= 4 AND length(body) >= 60
      ORDER BY created_at DESC LIMIT $1`,
    [limit],
  )
    .then((rows) => rows.map(toReview))
    .catch(softFail<Review[]>([]));
}

/** Rating summaries for every product that has a published review. */
export async function ratingSummaries(): Promise<Map<string, RatingSummary>> {
  return query<{ product_key: string; rating: number; count: number }>(
    `SELECT product_key, rating, count(*)::int AS count
       FROM product_reviews WHERE status = 'published'
      GROUP BY product_key, rating`,
  )
    .then((rows) => {
      const out = new Map<string, RatingSummary>();
      for (const row of rows) {
        const summary =
          out.get(row.product_key) ??
          ({ average: 0, count: 0, distribution: [0, 0, 0, 0, 0] } as RatingSummary);
        summary.distribution[row.rating - 1] += row.count;
        summary.count += row.count;
        out.set(row.product_key, summary);
      }
      for (const summary of out.values()) {
        const total = summary.distribution.reduce((sum, n, i) => sum + n * (i + 1), 0);
        summary.average = Math.round((total / summary.count) * 10) / 10;
      }
      return out;
    })
    .catch(softFail(new Map<string, RatingSummary>()));
}

/**
 * Whether this customer has this product: an order of theirs with a line for
 * it that is paid, or delivered (cash on delivery). Order lines record the
 * product id, which is the product key. A refunded order is neither.
 */
export async function hasPurchased(userId: number, productKey: string): Promise<boolean> {
  const row = await queryOne<{ found: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
        WHERE o.user_id = $1 AND i.product_id = $2
          AND (o.payment_status = 'paid' OR (o.status = 'delivered' AND o.payment_status <> 'refunded'))
     ) AS found`,
    [userId, productKey],
  );
  return row?.found ?? false;
}

/**
 * Write a review, or replace this customer's existing one for the product.
 *
 * Both publish immediately, except that an edit to a review the team hid
 * stays hidden. The team's reply stays: it answers the customer.
 */
export async function saveReview(input: {
  productKey: string;
  userId: number;
  authorName: string;
  city: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
}): Promise<'created' | 'updated'> {
  const row = await queryOne<{ inserted: boolean }>(
    `INSERT INTO product_reviews (product_key, user_id, author_name, city, rating, title, body, verified, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published')
     ON CONFLICT (product_key, user_id) DO UPDATE
       SET author_name = EXCLUDED.author_name, city = EXCLUDED.city, rating = EXCLUDED.rating,
           title = EXCLUDED.title, body = EXCLUDED.body, verified = EXCLUDED.verified,
           status = CASE WHEN product_reviews.status = 'hidden' THEN 'hidden' ELSE 'published' END,
           updated_at = now()
     RETURNING (xmax = 0) AS inserted`,
    [
      input.productKey,
      input.userId,
      input.authorName,
      input.city,
      input.rating,
      input.title,
      input.body,
      input.verified,
    ],
  );
  return row?.inserted ? 'created' : 'updated';
}

/**
 * Toggle this account's "helpful" vote on a published review. Returns the new
 * count and whether the account now has a vote on it, or null when there is no
 * such published review. A customer cannot vote on their own review.
 */
export async function toggleHelpful(
  reviewId: number,
  userId: number,
): Promise<{ count: number; voted: boolean } | 'own' | null> {
  const review = await queryOne<{ user_id: number }>(
    `SELECT user_id FROM product_reviews WHERE id = $1 AND status = 'published'`,
    [reviewId],
  );
  if (!review) return null;
  if (Number(review.user_id) === userId) return 'own';

  const removed = await queryOne<{ review_id: number }>(
    `DELETE FROM product_review_votes WHERE review_id = $1 AND user_id = $2 RETURNING review_id`,
    [reviewId, userId],
  );
  if (!removed) {
    await query(
      `INSERT INTO product_review_votes (review_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [reviewId, userId],
    );
  }
  const row = await queryOne<{ count: number }>(
    `SELECT count(*)::int AS count FROM product_review_votes WHERE review_id = $1`,
    [reviewId],
  );
  return { count: Number(row?.count ?? 0), voted: !removed };
}

/** This account's own reviews, newest first, with where each one stands. */
export async function reviewsByUser(userId: number): Promise<OwnReview[]> {
  const rows = await query<Row>(
    `SELECT r.*, ${HELPFUL} AS helpful_count, p.title AS product_title, p.slug AS product_slug
       FROM product_reviews r LEFT JOIN products p ON p.product_key = r.product_key
      WHERE r.user_id = $1 ORDER BY r.created_at DESC LIMIT 100`,
    [userId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    productKey: row.product_key,
    productTitle: row.product_title ?? null,
    productSlug: row.product_slug ?? null,
    rating: row.rating,
    title: row.title,
    body: row.body,
    city: row.city,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    helpfulCount: Number(row.helpful_count ?? 0),
    reply: row.admin_reply ?? null,
  }));
}

/* ------------------------------------------------------------- moderation */

export interface ModerationFilters {
  status?: ReviewStatus;
  rating?: number;
  /** Matches product title or key, review title or text, and author. */
  search?: string;
  /** Only reviews the team has not replied to. */
  unreplied?: boolean;
  limit: number;
  offset: number;
}

function moderationWhere(filters: Omit<ModerationFilters, 'limit' | 'offset'>) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`r.status = $${params.length}`);
  }
  if (filters.rating) {
    params.push(filters.rating);
    conditions.push(`r.rating = $${params.length}`);
  }
  if (filters.unreplied) conditions.push(`r.admin_reply IS NULL`);
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const i = params.length;
    conditions.push(
      `(p.title ILIKE $${i} OR r.product_key ILIKE $${i} OR r.title ILIKE $${i} ` +
        `OR r.body ILIKE $${i} OR r.author_name ILIKE $${i})`,
    );
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export async function reviewsForModeration(
  filters: ModerationFilters,
): Promise<{ reviews: ModerationReview[]; total: number }> {
  const { where, params } = moderationWhere(filters);
  const from = `FROM product_reviews r LEFT JOIN products p ON p.product_key = r.product_key ${where}`;
  const [totalRow, rows] = await Promise.all([
    queryOne<{ count: number }>(`SELECT count(*)::int AS count ${from}`, params),
    query<Row>(
      `SELECT r.*, ${HELPFUL} AS helpful_count, p.title AS product_title, p.slug AS product_slug
       ${from} ORDER BY r.created_at DESC, r.id DESC
       LIMIT ${Math.min(filters.limit, 100)} OFFSET ${Math.max(0, filters.offset)}`,
      params,
    ),
  ]);
  return {
    total: Number(totalRow?.count ?? 0),
    reviews: rows.map((row) => ({
      id: Number(row.id),
      productKey: row.product_key,
      productTitle: row.product_title ?? null,
      productSlug: row.product_slug ?? null,
      authorName: row.author_name,
      city: row.city,
      rating: row.rating,
      title: row.title,
      body: row.body,
      verified: row.verified,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
      moderatedBy: row.moderated_by,
      helpfulCount: Number(row.helpful_count ?? 0),
      reply: row.admin_reply ?? null,
      replyBy: row.admin_reply_by ?? null,
    })),
  };
}

/** The numbers at the top of the review dashboard. */
export async function reviewStats(): Promise<{
  byStatus: Record<ReviewStatus, number>;
  /** Published only — what shoppers see. */
  average: number | null;
  distribution: [number, number, number, number, number];
  unreplied: number;
}> {
  const rows = await query<{ status: ReviewStatus; rating: number; replied: boolean; count: number }>(
    `SELECT status, rating, admin_reply IS NOT NULL AS replied, count(*)::int AS count
       FROM product_reviews GROUP BY status, rating, admin_reply IS NOT NULL`,
  );
  const byStatus: Record<ReviewStatus, number> = { pending: 0, published: 0, hidden: 0 };
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let unreplied = 0;
  for (const row of rows) {
    const count = Number(row.count);
    byStatus[row.status] += count;
    if (row.status === 'published') {
      distribution[row.rating - 1] += count;
      if (!row.replied) unreplied += count;
    }
  }
  const published = byStatus.published;
  const average =
    published > 0
      ? Math.round((distribution.reduce((sum, n, i) => sum + n * (i + 1), 0) / published) * 10) / 10
      : null;
  return { byStatus, average, distribution, unreplied };
}

export async function moderateReview(id: number, status: ReviewStatus, actor: string): Promise<void> {
  await query(
    `UPDATE product_reviews SET status = $2, moderated_at = now(), moderated_by = $3 WHERE id = $1`,
    [id, status, actor],
  );
}

/** Set, replace or (with an empty reply) remove the team's public reply. */
export async function replyToReview(id: number, reply: string, actor: string): Promise<void> {
  await query(
    reply
      ? `UPDATE product_reviews SET admin_reply = $2, admin_reply_at = now(), admin_reply_by = $3 WHERE id = $1`
      : `UPDATE product_reviews SET admin_reply = NULL, admin_reply_at = NULL, admin_reply_by = NULL WHERE id = $1`,
    reply ? [id, reply, actor] : [id],
  );
}
