'use client';

import * as React from 'react';
import type { ServiceabilityResult } from './serviceability';

/**
 * The shopper's delivery pincode, remembered in this browser (R-10).
 *
 * `itarang.pincode` predates this file — the product page's delivery check has
 * always stored the bare code there — so it stays the key. Beside it sits the
 * last answer for that code (city and delivery days), so the header and the
 * listing cards can say "Delivering to 122001 · Gurugram" and "Delivers in ~7
 * days" without a request each. Every surface listens for the same event, so a
 * change in one place shows everywhere at once.
 */

export const PINCODE_KEY = 'itarang.pincode';
const PLACE_KEY = 'itarang.pincode.place';
const EVENT = 'itarang:pincode';

export interface SavedPincode {
  pincode: string;
  city?: string;
  state?: string;
  deliveryDays?: number;
  serviceable?: boolean;
}

function read(): SavedPincode | null {
  try {
    const pincode = window.localStorage.getItem(PINCODE_KEY);
    if (!pincode) return null;
    const raw = window.localStorage.getItem(PLACE_KEY);
    const place = raw ? (JSON.parse(raw) as SavedPincode) : null;
    return place?.pincode === pincode ? place : { pincode };
  } catch {
    return null;
  }
}

/** Remember a checked pincode and its answer, and tell every listener. */
export function savePincode(result: ServiceabilityResult): void {
  const saved: SavedPincode = {
    pincode: result.pincode,
    city: result.city,
    state: result.state,
    deliveryDays: result.deliveryDays,
    serviceable: result.serviceable,
  };
  try {
    window.localStorage.setItem(PINCODE_KEY, result.pincode);
    window.localStorage.setItem(PLACE_KEY, JSON.stringify(saved));
  } catch {
    /* private mode — nothing to remember, but this page still updates */
  }
  cached = saved;
  window.dispatchEvent(new Event(EVENT));
}

/** Look a pincode up and remember the answer. Resolves to the error text on failure. */
export async function checkPincode(
  code: string,
): Promise<{ ok: true; result: ServiceabilityResult } | { ok: false; error: string }> {
  try {
    const response = await fetch(`/api/pincode?code=${encodeURIComponent(code)}`);
    const data = await response.json();
    if (!response.ok) return { ok: false, error: data.error ?? 'Could not check this pincode.' };
    const result = data as ServiceabilityResult;
    savePincode(result);
    return { ok: true, result };
  } catch {
    return { ok: false, error: 'Could not check delivery just now.' };
  }
}

let cached: SavedPincode | null | undefined;

function subscribe(onChange: () => void): () => void {
  const refresh = () => {
    cached = read();
    onChange();
  };
  window.addEventListener(EVENT, refresh);
  // Another tab changing it.
  window.addEventListener('storage', refresh);
  return () => {
    window.removeEventListener(EVENT, refresh);
    window.removeEventListener('storage', refresh);
  };
}

function snapshot(): SavedPincode | null {
  if (cached === undefined) cached = read();
  return cached;
}

/** The remembered pincode, or null; always null during server render. */
export function useSavedPincode(): SavedPincode | null {
  return React.useSyncExternalStore(subscribe, snapshot, () => null);
}
