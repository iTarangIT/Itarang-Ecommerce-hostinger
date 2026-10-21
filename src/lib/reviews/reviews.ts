import { query, queryOne } from '@/lib/db/pool';
import type { RatingSummary, Review } from '@/lib/commerce/types';

/**
 * Product reviews: written by signed-in customers, shown once an administrator
 * publishes them.
 *
 * Server-only. Two rules shape everything here:
 *
 * - **Nothing is shown unmoderated.** A review is `pending` until published;
 *   only `published` rows reach the storefront, the rating average or the
 *   structured data a search engine reads.
 * - **"Verified purchase" means a paid order.** It is decided when the review
 *   is written, from the reviewer's own orders, and stored.
 *
 * The read paths fail soft. The catalogue calls them on every product load,
 * and a database that has not had migration 0021 yet must still serve
 * products — with no ratings, which is the truth for that database.
 */

export type ReviewStatus = 'pending' | 'published' | 'hidden';

export interface ModerationReview {
  id: number;
  productKey: string;
  authorName: string;
  city: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  status: ReviewStatus;
  createdAt: string;
  moderatedBy: string | null;
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
  moderated_by: string | null;
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
    helpfulCount: 0,
    hasPhotos: false,
  };
}

/** Published reviews for one product, newest first. */
export async function publishedReviews(productKey: string, limit = 100): Promise<Review[]> {
  return query<Row>(
    `SELECT * FROM product_reviews
      WHERE product_key = $1 AND status = 'published'
      ORDER BY created_at DESC LIMIT $2`,
    [productKey, limit],
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
 * Whether this customer bought this product: a paid order of theirs with a
 * line for it. Order lines record the product id, which is the product key.
 */
export async function hasPurchased(userId: number, productKey: string): Promise<boolean> {
  const row = await queryOne<{ found: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
        WHERE o.user_id = $1 AND i.product_id = $2 AND o.payment_status = 'paid'
     ) AS found`,
    [userId, productKey],
  );
  return row?.found ?? false;
}

export async function hasReviewed(userId: number, productKey: string): Promise<boolean> {
  const row = await queryOne<{ found: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM product_reviews WHERE user_id = $1 AND product_key = $2) AS found`,
    [userId, productKey],
  );
  return row?.found ?? false;
}

export async function createReview(input: {
  productKey: string;
  userId: number;
  authorName: string;
  city: string | null;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
}): Promise<'created' | 'duplicate'> {
  const row = await queryOne<{ id: number }>(
    `INSERT INTO product_reviews (product_key, user_id, author_name, city, rating, title, body, verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (product_key, user_id) DO NOTHING
     RETURNING id`,
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
  return row ? 'created' : 'duplicate';
}

export async function reviewsForModeration(status: ReviewStatus): Promise<ModerationReview[]> {
  const rows = await query<Row>(
    `SELECT * FROM product_reviews WHERE status = $1 ORDER BY created_at DESC LIMIT 200`,
    [status],
  );
  return rows.map((row) => ({
    id: row.id,
    productKey: row.product_key,
    authorName: row.author_name,
    city: row.city,
    rating: row.rating,
    title: row.title,
    body: row.body,
    verified: row.verified,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    moderatedBy: row.moderated_by,
  }));
}

export async function moderateReview(id: number, status: ReviewStatus, actor: string): Promise<void> {
  await query(
    `UPDATE product_reviews SET status = $2, moderated_at = now(), moderated_by = $3 WHERE id = $1`,
    [id, status, actor],
  );
}
