'use client';

import type { FunnelEventName } from './events';

/**
 * Client-side funnel beacons.
 *
 * `sendBeacon` and nothing else, for one reason: it hands the request to the
 * browser and returns immediately, so a beacon cannot delay a navigation, block
 * a click handler, or keep a page alive. That property is the whole point —
 * the storefront's prerendering and first-load budget were hard-won, and
 * analytics is not allowed to spend them.
 *
 * Consequences, accepted deliberately:
 *
 *   - There is no response to read, so there is no retry and no error handling.
 *     A dropped beacon is a slightly-low funnel number, which is the correct
 *     price for never risking a shopper's page.
 *   - Ordering is not guaranteed. Nothing here depends on it; stages are
 *     reconstructed from timestamps server-side.
 *
 * Everything financial — payment initiated, payment captured, order placed — is
 * derived server-side from `payments` and `order_events`. Nothing on this page
 * can influence those, by design.
 */

const ENDPOINT = '/api/events';

interface TrackPayload {
  productId?: string;
  variantId?: string;
  quantity?: number;
  /**
   * Scopes idempotency. Two identical events in one session collapse unless
   * this differs — pass something per-intent when repeats are meaningful.
   */
  dedupe?: string;
}

export function track(event: FunnelEventName, payload: TrackPayload = {}): void {
  // Server components import this module's sibling for their own recording;
  // guard anyway so an accidental server import is inert rather than fatal.
  if (typeof window === 'undefined') return;

  try {
    const body = JSON.stringify({ event, ...payload });

    if (typeof navigator.sendBeacon === 'function') {
      // text/plain keeps it a CORS-simple request, so it never triggers a
      // preflight that a navigation could cancel.
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
      return;
    }

    // Older browsers: `keepalive` gives the same survive-the-navigation
    // guarantee. Failure is swallowed for the same reason as above.
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    }).catch(() => {});
  } catch {
    // A tracking call must never surface to a shopper.
  }
}
