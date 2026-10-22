'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { invalidateCatalogSnapshot } from '@/lib/commerce';
import { CATALOG_TAG } from '@/lib/commerce/db/db-provider';
import { currentUser } from '@/lib/auth/session';
import { LIMITS, consume } from '@/lib/security/rate-limit';
import { hasPurchased, saveReview, toggleHelpful } from './reviews';

/**
 * Write a review.
 *
 * Eligibility is decided here, at submit time, rather than on the product page:
 * the page is statically rendered and must not read a session. So the form is
 * shown to everyone and this answers the questions in order — signed in, bought
 * it — with a sentence that says what to do next. Submitting again replaces the
 * customer's earlier review (one per product, as on Amazon) and it is checked
 * again before it shows.
 *
 * Only buyers may review. A paid order containing the product is the proof, and
 * the review is stored as verified and shown straight away; an administrator
 * can hide it afterwards.
 */

export type ReviewSubmitResult =
  | { ok: true; updated: boolean }
  | { ok: false; reason: 'signin' | 'not-buyer' | 'invalid' | 'throttled' | 'error'; message: string };

const schema = z.object({
  productKey: z.string().trim().min(1).max(200),
  rating: z.number().int().min(1, 'Choose a star rating.').max(5),
  title: z.string().trim().min(3, 'Add a short title.').max(120),
  body: z
    .string()
    .trim()
    .min(20, 'Tell other buyers a little more — at least 20 characters.')
    .max(4000),
  city: z.string().trim().max(80).optional(),
});

export async function submitReviewAction(input: {
  productKey: string;
  rating: number;
  title: string;
  body: string;
  city?: string;
}): Promise<ReviewSubmitResult> {
  const user = await currentUser();
  if (!user) {
    return { ok: false, reason: 'signin', message: 'Sign in to write a review.' };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', message: parsed.error.issues[0]!.message };
  }
  const { productKey, rating, title, body, city } = parsed.data;

  const limit = await consume(`review:${user.id}`, LIMITS.review);
  if (!limit.allowed) {
    return { ok: false, reason: 'throttled', message: 'Too many reviews just now. Try again later.' };
  }

  try {
    if (!(await hasPurchased(user.id, productKey))) {
      return {
        ok: false,
        reason: 'not-buyer',
        message: 'Only customers who bought this product on iTarang can review it.',
      };
    }
    const authorName = (user.fullName ?? user.email.split('@')[0] ?? 'Customer').split(/\s+/)[0]!;
    const result = await saveReview({
      productKey,
      userId: user.id,
      authorName: authorName.slice(0, 80),
      city: city || null,
      rating,
      title,
      body,
      verified: true,
    });
    // Ratings ride on the cached catalogue, so the product page shows the new
    // review on its next load.
    invalidateCatalogSnapshot();
    revalidateTag(CATALOG_TAG);
    return { ok: true, updated: result === 'updated' };
  } catch (error) {
    console.error('[reviews] could not save review', error);
    return { ok: false, reason: 'error', message: 'We could not save your review. Please try again.' };
  }
}

export type HelpfulResult =
  | { ok: true; count: number; voted: boolean }
  | { ok: false; reason: 'signin' | 'own' | 'gone' | 'throttled' | 'error'; message: string };

/**
 * Mark a review helpful, or take the vote back. One vote per account per
 * review, so the count means people, not clicks.
 */
export async function toggleHelpfulAction(reviewId: string): Promise<HelpfulResult> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: 'signin', message: 'Sign in to vote.' };

  const id = Number(reviewId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { ok: false, reason: 'gone', message: 'That review is no longer available.' };
  }

  const limit = await consume(`review-vote:${user.id}`, LIMITS.reviewVote);
  if (!limit.allowed) {
    return { ok: false, reason: 'throttled', message: 'Too many votes just now. Try again later.' };
  }

  try {
    const result = await toggleHelpful(id, user.id);
    if (result === 'own') {
      return { ok: false, reason: 'own', message: 'You cannot vote on your own review.' };
    }
    if (!result) return { ok: false, reason: 'gone', message: 'That review is no longer available.' };
    return { ok: true, ...result };
  } catch (error) {
    console.error('[reviews] could not record vote', error);
    return { ok: false, reason: 'error', message: 'We could not record your vote. Please try again.' };
  }
}
