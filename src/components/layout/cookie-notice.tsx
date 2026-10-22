'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'itarang.cookie-notice.v1';

/**
 * A one-time notice about cookies.
 *
 * The site sets only first-party cookies — the session, the cart and the
 * visitor id the analytics funnel uses — and no third-party trackers, so this
 * is a notice, not a consent wall: it says what is used and goes away once
 * acknowledged. Shown after the page has settled so it never shifts layout
 * on first paint, and sits above the mobile bottom navigation.
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
    const timer = window.setTimeout(() => setVisible(true), 1500);
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
      className="fixed inset-x-3 print:hidden bottom-[calc(var(--bottom-nav-height)+0.75rem)] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-lg sm:p-4 lg:bottom-6"
    >
      {/* One compact row on a phone so it does not cover half the screen. */}
      <p className="min-w-0 flex-1 text-xs text-muted-foreground sm:text-sm">
        We use our own cookies to keep you signed in, remember your cart and understand how the
        site is used. No advertising trackers.
      </p>
      <Button size="sm" className="shrink-0" onClick={dismiss}>
        Got it
      </Button>
    </div>
  );
}
