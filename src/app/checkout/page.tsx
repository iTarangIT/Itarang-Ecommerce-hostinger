import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { paymentProvider } from '@/lib/payments';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { CheckoutFlow } from '@/components/checkout/checkout-flow';
import { peekVisitor, record } from '@/lib/analytics/events';
import { currentUser } from '@/lib/auth/session';
import { listAddresses } from '@/lib/account/addresses';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your iTarang order.',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // The login wall, recorded before it is hit.
  //
  // `requireUser` redirects, so nothing below this line runs for an anonymous
  // shopper — which is precisely why the funnel could never see them. This is
  // the last stage an unregistered visitor can reach and the largest drop in
  // the product, so it is recorded here, ahead of the redirect.
  //
  // Server-written like `begin_checkout` below, and for the same reason: a
  // browser that never opened this page cannot forge one. `peekVisitor` is
  // correct here rather than `visitorContext` — a page render may not write
  // cookies, and a shopper who reached checkout has browsed first, so the
  // cookies are there. A cold entry goes unrecorded rather than invented.
  // `currentUser` is request-cached, so this costs no extra query — the
  // `requireUser` below reads the same result.
  const signedIn = await currentUser();
  if (!signedIn) {
    const arriving = await peekVisitor();
    if (arriving) {
      await record({
        event: 'checkout_intent',
        visitor: { ...arriving, freshVisitor: false, freshSession: false },
      });
    }
  }

  // Placing an order requires an account. The cart lives in localStorage, so a
  // round trip through /login and back leaves it exactly as it was — the
  // shopper returns to a full cart rather than an empty one.
  const user = await requireUser('/checkout');

  // The funnel's checkout stage, recorded on the server.
  //
  // This page is already `force-dynamic`, so there is no caching to lose, and a
  // server-written event cannot be forged by a browser that never opened the
  // page. That is worth more here than at the earlier stages, because this is
  // the last one before money is involved.
  //
  // `peekVisitor` reads the cookies without minting them — a page render may
  // not write cookies. A shopper arriving here has browsed first and will have
  // them; the rare cold entry simply goes unrecorded rather than being invented.
  const visitor = await peekVisitor();
  if (visitor) {
    await record({
      event: 'begin_checkout',
      visitor: { ...visitor, freshVisitor: false, freshSession: false },
      userId: user.id,
    });
  }

  /*
   * This customer's saved addresses, read with the session's own id.
   *
   * `listAddresses` filters on `user_id` in SQL and excludes archived rows, so
   * another customer's address is never in hand and none of these ids can be
   * anything but this account's. Nothing in the request can influence which
   * account is read — there is no parameter for it.
   *
   * These are a *convenience*: the values are copied into the same address
   * form the shopper could have typed by hand, and the server re-validates and
   * snapshots what is submitted. No address id is sent with the order, so
   * there is no id for the server to resolve and no ownership question at
   * placement time. See `checkout-flow.tsx` for why that is the safer shape.
   */
  const savedAddresses = await listAddresses(user.id);

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-5 sm:py-7">
          <Breadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Cart', href: '/cart' },
              { label: 'Checkout' },
            ]}
          />
          <h1 className="heading-1 mt-3">Checkout</h1>
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <CheckoutFlow
          account={{ email: user.email, fullName: user.fullName, phone: user.phone }}
          savedAddresses={savedAddresses}
          provider={paymentProvider().id}
        />
      </div>
    </>
  );
}
