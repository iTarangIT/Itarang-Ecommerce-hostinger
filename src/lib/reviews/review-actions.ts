'use server';

import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { LIMITS, consume } from '@/lib/security/rate-limit';
import { createReview, hasPurchased, hasReviewed } from './reviews';

/**
 * Write a review.
 *
 * Eligibility is decided here, at submit time, rather than on the product page:
 * the page is statically rendered and must not read a session. So the form is
 * shown to everyone and this answers the three questions in order — signed in,
 * bought it, not already reviewed — with a sentence that says what to do next.
 *
 * Only buyers may review. A paid order containing the product is the proof, and
 * the review is stored as verified. Nothing is shown until an administrator
 * publishes it.
 */

export type ReviewSubmitResult =
  | { ok: true }
  | { ok: false; reason: 'signin' | 'not-buyer' | 'duplicate' | 'invalid' | 'throttled' | 'error'; message: string };

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
    if (await hasReviewed(user.id, productKey)) {
      return { ok: false, reason: 'duplicate', message: 'You have already reviewed this product.' };
    }

    const authorName = (user.fullName ?? user.email.split('@')[0] ?? 'Customer').split(/\s+/)[0]!;
    const result = await createReview({
      productKey,
      userId: user.id,
      authorName: authorName.slice(0, 80),
      city: city || null,
      rating,
      title,
      body,
      verified: true,
    });
    if (result === 'duplicate') {
      return { ok: false, reason: 'duplicate', message: 'You have already reviewed this product.' };
    }
    return { ok: true };
  } catch (error) {
    console.error('[reviews] could not save review', error);
    return { ok: false, reason: 'error', message: 'We could not save your review. Please try again.' };
  }
}
