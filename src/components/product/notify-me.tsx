'use client';

import * as React from 'react';
import { BellRing, Check, Loader2 } from 'lucide-react';
import {
  notifyWhenBackInStockAction,
  stockNotificationStatusAction,
  type NotifyMeState,
} from '@/lib/stock/notify-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

/**
 * "Tell me when this is back", on an out-of-stock product page.
 *
 * The product page itself is unchanged and still fully readable when a product
 * is sold out — that was already true, and this release keeps it true. What was
 * missing was anything to do about it: the buy box offered "size your system"
 * and a `mailto:` link, so a shopper who wanted this exact battery had no way
 * to register that and we had no way to know they existed.
 *
 * The copy promises one message and nothing else, which is what the system
 * actually does: a notification is sent by an administrator, once per restock,
 * guarded by a primary key that makes a second send for the same person and the
 * same event impossible.
 *
 * A guest sees an empty field and may still sign up — requiring an account to be
 * told a product is available would lose the sale.
 *
 * **The session is read here, after mount, and never during the page render.**
 * The address to prefill and "you are already on the list" both need a session,
 * and a server component that reaches for one turns the whole product page into
 * a per-request render: `cookies()` opts a route out of static generation, so a
 * single sold-out product would drop its page off the prerendered set while
 * every in-stock one stayed on it. That is exactly what happened — the sold-out
 * product page was the only page on the storefront rendered on demand, and the
 * only one that could fail in production while the rest served cached HTML.
 *
 * So the page stays static and this control fills itself in: one call to
 * `stockNotificationStatusAction`, made only on a sold-out product, by the one
 * component that has something to do with the answer. A guest gets nulls and an
 * empty field, which is the same thing they saw before.
 */
export function NotifyMe({ productId, sku }: { productId: string; sku: string }) {
  const [state, formAction, pending] = React.useActionState<NotifyMeState, FormData>(
    notifyWhenBackInStockAction,
    { status: 'idle' },
  );

  // Seeded empty and filled in once the session answers. `edited` keeps that
  // answer from overwriting an address the shopper has already started typing —
  // the fetch is fast, but not faster than someone with the field focused.
  const [email, setEmail] = React.useState('');
  const [alreadySubscribed, setAlreadySubscribed] = React.useState(false);
  const edited = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    stockNotificationStatusAction(productId, sku)
      .then((status) => {
        if (cancelled) return;
        if (status.email && !edited.current) setEmail(status.email);
        setAlreadySubscribed(status.subscribed);
      })
      // A failure here costs the prefill and nothing else: the form still
      // works, and submitting is what actually records the request.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [productId, sku]);

  const done =
    state.status === 'subscribed' ||
    state.status === 'already' ||
    (state.status === 'idle' && alreadySubscribed);

  if (done) {
    return (
      <div className="rounded-lg border border-success/40 bg-success-soft p-3">
        <p className="flex items-start gap-2 text-sm font-medium text-foreground">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>{state.message ?? 'You are on the list for this product.'}</span>
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-lg border border-border bg-surface p-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="sku" value={sku} />

      <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
        Tell me when it is back
      </p>
      <p className="mt-1 pl-6 text-xs text-muted-foreground">
        One email, as soon as this product is available again. Nothing else.
      </p>

      <div className="mt-2.5 flex flex-wrap items-start gap-2 pl-6">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Your email address</span>
          <Input
            type="email"
            name="email"
            required
            value={email}
            onChange={(event) => {
              edited.current = true;
              setEmail(event.target.value);
            }}
            placeholder="you@example.com"
            autoComplete="email"
            className="h-10"
          />
        </label>
        <Button type="submit" variant="accent" className="h-10" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          Notify me
        </Button>
      </div>

      {state.status === 'error' && state.message ? (
        <p className="mt-2 pl-6 text-xs font-medium text-destructive">{state.message}</p>
      ) : null}
    </form>
  );
}
