'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { submitReviewAction } from '@/lib/reviews/review-actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * "Write a review", opened in place.
 *
 * Shown to everyone because the product page is static; the server action
 * decides who may actually review (signed in, bought it, not yet reviewed) and
 * this renders its answer — including a sign-in link that comes back here.
 */
export function ReviewForm({
  productKey,
  productPath,
  label = 'Write a review',
}: {
  productKey: string;
  /** Where the sign-in link returns to. */
  productPath: string;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [city, setCity] = React.useState('');
  const [error, setError] = React.useState<{ message: string; signin?: boolean } | null>(null);
  const [done, setDone] = React.useState<'created' | 'updated' | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (done) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        {done === 'updated'
          ? 'Your review has been updated. It will reappear once our team has checked the changes.'
          : 'Thank you. Your review will appear once our team has checked it.'}
      </p>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" fullWidth onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-card p-4 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await submitReviewAction({ productKey, rating, title, body, city });
          if (result.ok) setDone(result.updated ? 'updated' : 'created');
          else setError({ message: result.message, signin: result.reason === 'signin' });
        });
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium text-foreground">Your rating</legend>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
              aria-pressed={rating === star}
              onMouseEnter={() => setHover(star)}
              onClick={() => setRating(star)}
              className="rounded-sm p-0.5"
            >
              <Star
                className={cn(
                  'h-6 w-6',
                  (hover || rating) >= star ? 'fill-accent text-accent' : 'text-border',
                )}
              />
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Title" htmlFor="review-title" required>
        <Input
          id="review-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Good range on my e-rickshaw"
        />
      </Field>
      <Field label="Your review" htmlFor="review-body" required>
        <Textarea
          id="review-body"
          value={body}
          rows={4}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How long have you used it, what for, and how has it performed?"
        />
      </Field>
      <Field label="City" htmlFor="review-city">
        <Input id="review-city" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
      </Field>

      {error ? (
        <p className="text-sm font-medium text-destructive">
          {error.message}{' '}
          {error.signin ? (
            <Link href={`/login?next=${encodeURIComponent(productPath)}`} className="underline">
              Sign in
            </Link>
          ) : null}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit review
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Only customers who bought this product can review it. Reviews are checked before they
        appear. Reviewed it already? Submitting again replaces your earlier review.
      </p>
    </form>
  );
}
