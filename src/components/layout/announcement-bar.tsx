'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

// v3: coupon lines now come from the admin's campaigns, so a bar dismissed for
// the old fixed lines shows again. Changing the set of codes changes the key
// too (see `storageKey`), so a new campaign is never hidden by an old dismissal.
const STORAGE_PREFIX = 'itarang.announcement.dismissed.v3';

/**
 * Only offers that exist.
 *
 * Two were removed. "No-cost EMI available from ₹5,000" — `emiEnabled` is false
 * on every product and `DbCatalogProvider.listOffers()` returns nothing, so the
 * bar advertised an arrangement no lender has agreed to and linked to an empty
 * page. "₹1,500 off inverter + battery combos with COMBO1500" — the catalogue
 * holds no combos and the coupon is a development fixture, so the link landed
 * on an empty category with a code that buys nothing.
 *
 * What is here now is what the business specified and the checkout applies:
 * the campaigns marked "show on site" in /admin/campaigns, the UPI discount
 * (`UPI_DISCOUNT`, applied by `buildQuote`) and free delivery
 * (`FREE_SHIPPING_THRESHOLD`). No card offers and no no-cost EMI — the business
 * has neither online.
 */
const STANDING_MESSAGES = [
  { text: 'Extra ₹200 off when you pay by UPI', href: '/offers' },
  { text: 'Free delivery on orders above ₹4,999', href: '/offers' },
];

/**
 * Rotating announcement bar. Dismissal is remembered so it does not nag on
 * every visit, and rotation pauses on hover and for reduced-motion users.
 */
export function AnnouncementBar({ coupons }: { coupons: string[] }) {
  const messages = React.useMemo(
    () => [...coupons.map((text) => ({ text, href: '/offers' })), ...STANDING_MESSAGES],
    [coupons],
  );
  // Keyed on the lines themselves, so a new campaign is shown even to someone
  // who dismissed the bar for the previous set.
  const storageKey = `${STORAGE_PREFIX}.${coupons.join('|')}`;
  const [dismissed, setDismissed] = React.useState(true);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  const count = messages.length;
  React.useEffect(() => {
    if (dismissed || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), 5500);
    return () => window.clearInterval(timer);
  }, [dismissed, paused, count]);

  if (dismissed) return null;

  const message = messages[index % count]!;

  return (
    <div
      className="relative bg-ink-900 text-ink-50 print:hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="container flex h-9 items-center justify-center gap-2">
        <Link
          key={index}
          href={message.href}
          className="group inline-flex animate-fade-in items-center gap-1.5 truncate text-xs font-medium tracking-wide sm:text-[0.8125rem]"
        >
          <span className="truncate">{message.text}</span>
          <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block" />
        </Link>
      </div>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          try {
            window.localStorage.setItem(storageKey, '1');
          } catch {
            /* non-blocking */
          }
        }}
        aria-label="Dismiss announcement"
        className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-ink-50/70 transition-colors hover:bg-white/10 hover:text-ink-50 sm:right-3"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
