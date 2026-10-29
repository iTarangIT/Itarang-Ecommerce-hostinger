'use client';

import * as React from 'react';
import Link from 'next/link';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'itarang.cookie-notice.v1';

/**
 * A one-time notice about cookies, as a full-width bar along the bottom.
 *
 * The site sets only first-party cookies — the session, the cart and the
 * visitor id the analytics funnel uses — and no third-party trackers, so this
 * is a notice, not a consent wall: it says what is used and goes away once
 * acknowledged, by "Got it" or the close button alike. It appears together
 * with the first-visit expert popup, and sits below that popup's overlay and
 * above the mobile bottom navigation.
 */
export function CookieNotice() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      seen = true; // storage blocked: nothing to remember the choice in, so do not nag
    }
    if (seen) return;
    const timer = window.setTimeout(() => setVisible(true), 800);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* non-blocking */
    }
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom,0px))] z-50 animate-slide-up border-t border-border bg-card shadow-overlay print:hidden lg:bottom-0"
    >
      <div className="container flex items-center gap-3 py-3 sm:gap-5 sm:py-4">
        <Cookie aria-hidden className="hidden h-10 w-10 shrink-0 text-primary sm:block" strokeWidth={1.75} />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          This website uses cookies to keep you signed in, remember your cart and understand how the
          site is used, so we can improve your browsing experience. We do not use advertising
          trackers.{' '}
          <Link href="/policies/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
            Privacy policy
          </Link>
        </p>
        <Button className="shrink-0 rounded-full px-6 sm:px-10" onClick={dismiss}>
          Got it
        </Button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close cookie notice"
          className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
