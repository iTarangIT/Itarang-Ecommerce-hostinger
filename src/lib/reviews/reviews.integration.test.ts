import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import {
  hasPurchased,
  moderateReview,
  publishedReviews,
  replyToReview,
  reviewStats,
  reviewsByUser,
  reviewsForModeration,
  saveReview,
  toggleHelpful,
} from './reviews';

/**
 * Reviews against a real database: who may review, what an edit does to a
 * published review, one helpful vote per person, and the team's reply reaching
 * the storefront. None of it is visible without the SQL.
 */

function targetsRemote(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn(
    REMOTE
      ? '\n  [skipped] Review tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Review tests need DATABASE_URL pointing at a local itarang_dev database.\n',
  );
}

const PRODUCT = 'review-fixture-product';
const PHONE = '9000000079';
const EMAILS = ['review.buyer@example.com', 'review.voter@example.com'];

async function makeUser(email: string, fullName: string): Promise<number> {
  const rows = await query<{ id: number }>(
    `INSERT INTO users (email, password_hash, role, full_name) VALUES ($1, 'x', 'customer', $2) RETURNING id`,
    [email, fullName],
  );
  return Number(rows[0]!.id);
}

async function makeOrder(
  userId: number,
  status: string,
  paymentStatus: string,
  orderNumber: string,
): Promise<void> {
  const rows = await query<{ id: number }>(
    `INSERT INTO orders (order_number, user_id, status, payment_status, customer_name, customer_phone,
                         shipping_address, subtotal, total, payment_method, is_test)
     VALUES ($1, $2, $3, $4, 'Review Buyer', $5,
             jsonb_build_object('line1', '1 Test St', 'city', 'Pune', 'state', 'MH', 'pincode', '411001'),
             100000, 100000, 'cod', true)
     RETURNING id`,
    [orderNumber, userId, status, paymentStatus, PHONE],
  );
  await query(
    `INSERT INTO order_items (order_id, product_id, variant_id, sku, title, unit_mrp, unit_price, quantity, line_total)
     VALUES ($1, $2, 'review-fixture-variant', 'RV-1', 'Fixture battery', 100000, 100000, 1, 100000)`,
    [rows[0]!.id, PRODUCT],
  );
}

async function cleanUp(): Promise<void> {
  await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
  await query(`DELETE FROM product_reviews WHERE product_key = $1`, [PRODUCT]);
  await query(`DELETE FROM users WHERE email = ANY($1)`, [EMAILS]);
  await query(`DELETE FROM products WHERE product_key = $1`, [PRODUCT]);
}

const REVIEW = {
  productKey: PRODUCT,
  authorName: 'Asha',
  city: 'Pune',
  rating: 4,
  title: 'Solid battery',
  body: 'Six months on my e-rickshaw and the range has held up well.',
  verified: true,
};

describe.skipIf(!CONFIGURED)('product reviews', () => {
  let buyer = 0;
  let voter = 0;

  beforeEach(async () => {
    await cleanUp();
    await query(
      `INSERT INTO products (product_key, slug, status, title, category, subcategory)
       VALUES ($1, $1, 'published', 'Fixture battery', 'batteries', 'ev')`,
      [PRODUCT],
    );
    buyer = await makeUser(EMAILS[0]!, 'Asha Buyer');
    voter = await makeUser(EMAILS[1]!, 'Vik Voter');
  });

  afterAll(async () => {
    await cleanUp();
    await closePool();
  });

  it('a delivered cash-on-delivery order counts as a purchase; an undelivered unpaid one does not', async () => {
    await makeOrder(buyer, 'confirmed', 'pending', 'ITG-RV-000001');
    expect(await hasPurchased(buyer, PRODUCT)).toBe(false);

    await makeOrder(buyer, 'delivered', 'pending', 'ITG-RV-000002');
    expect(await hasPurchased(buyer, PRODUCT)).toBe(true);
    expect(await hasPurchased(voter, PRODUCT)).toBe(false);
  });

  it('writing again replaces the review and sends it back for checking', async () => {
    expect(await saveReview({ ...REVIEW, userId: buyer })).toBe('created');
    const [first] = (await reviewsByUser(buyer));
    await moderateReview(first!.id, 'published', 'admin@example.com');
    expect(await publishedReviews(PRODUCT)).toHaveLength(1);

    expect(await saveReview({ ...REVIEW, userId: buyer, rating: 2, title: 'Changed my mind' })).toBe('updated');
    const [edited] = await reviewsByUser(buyer);
    expect(edited).toMatchObject({ id: first!.id, rating: 2, status: 'pending' });
    expect(edited!.updatedAt).not.toBeNull();
    expect(await publishedReviews(PRODUCT)).toHaveLength(0);
  });

  it('one helpful vote per person, toggled; no voting on your own review', async () => {
    await saveReview({ ...REVIEW, userId: buyer });
    const [own] = await reviewsByUser(buyer);

    // Not published yet: nothing to vote on.
    expect(await toggleHelpful(own!.id, voter)).toBeNull();
    await moderateReview(own!.id, 'published', 'admin@example.com');

    expect(await toggleHelpful(own!.id, buyer)).toBe('own');
    expect(await toggleHelpful(own!.id, voter)).toEqual({ count: 1, voted: true });
    expect((await publishedReviews(PRODUCT))[0]!.helpfulCount).toBe(1);
    expect(await toggleHelpful(own!.id, voter)).toEqual({ count: 0, voted: false });
  });

  it('the team reply reaches the storefront and the moderation filters', async () => {
    await saveReview({ ...REVIEW, userId: buyer, rating: 2 });
    const [own] = await reviewsByUser(buyer);
    await moderateReview(own!.id, 'published', 'admin@example.com');

    const unreplied = await reviewsForModeration({ search: 'Fixture battery', unreplied: true, limit: 20, offset: 0 });
    expect(unreplied.total).toBe(1);
    expect(unreplied.reviews[0]).toMatchObject({ productTitle: 'Fixture battery', rating: 2 });

    await replyToReview(own!.id, 'Sorry to hear this — our team will call you.', 'admin@example.com');
    const [shown] = await publishedReviews(PRODUCT);
    expect(shown!.reply?.body).toBe('Sorry to hear this — our team will call you.');
    expect((await reviewsForModeration({ search: 'Fixture battery', unreplied: true, limit: 20, offset: 0 })).total).toBe(0);
    expect((await reviewsForModeration({ rating: 2, search: PRODUCT, limit: 20, offset: 0 })).total).toBe(1);

    const stats = await reviewStats();
    expect(stats.byStatus.published).toBeGreaterThanOrEqual(1);

    await replyToReview(own!.id, '', 'admin@example.com');
    expect((await publishedReviews(PRODUCT))[0]!.reply).toBeUndefined();
  });
});
