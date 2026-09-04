'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

const STORAGE_KEY = 'itarang.announcement.dismissed.v1';

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
 * The delivery line stays: unlike those two it is implemented, by
 * `FREE_SHIPPING_THRESHOLD` in `lib/store/totals.ts`, and the cart applies it.
 * Whether the business wants to offer it is a separate question, recorded under
 * business confirmation rather than answered here.
 */
const MESSAGES = [{ text: 'Free delivery on orders above ₹4,999', href: '/offers' }];

/**
 * Rotating announcement bar. Dismissal is remembered so it does not nag on
 * every visit, and rotation pauses on hover and for reduced-motion users.
 */
export function AnnouncementBar() {
  const [dismissed, setDismissed] = React.useState(true);
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  React.useEffect(() => {
    if (dismissed || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 5500);
    return () => window.clearInterval(timer);
  }, [dismissed, paused]);

  if (dismissed) return null;

  const message = MESSAGES[index];

  return (
    <div
      className="relative bg-ink-900 text-ink-50"
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
            window.localStorage.setItem(STORAGE_KEY, '1');
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
