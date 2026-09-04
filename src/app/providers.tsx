'use client';

import * as React from 'react';
import { StoreProvider } from '@/lib/store/store-provider';
import { WishlistSync } from '@/lib/store/wishlist-sync';
import { UIProvider } from '@/lib/store/ui-provider';
import { track } from '@/lib/analytics/track';

/**
 * The funnel's first stage.
 *
 * Fired once per full page load, not once per session — the server does the
 * sessionising. `funnel_events.dedupe_key` is derived from the event name and
 * the session id, so every `visit` inside one browsing session collapses to a
 * single row, and a new session only begins when the session cookie has been
 * left to expire. Keeping that rule on the server means it cannot be skewed by
 * a browser that clears storage, and the client needs no state at all.
 *
 * There is no middleware in this application (the Edge runtime has no `pg`
 * access, so the authorization boundary deliberately lives in layouts and route
 * handlers), which is why this is a beacon rather than request-level logging.
 */
function VisitBeacon() {
  React.useEffect(() => {
    track('visit');
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UIProvider>
      <StoreProvider>
        <VisitBeacon />
        {/* Folds this browser's saved products into the signed-in account, once
            per browser and account. Renders nothing. */}
        <WishlistSync />
        {children}
      </StoreProvider>
    </UIProvider>
  );
}
