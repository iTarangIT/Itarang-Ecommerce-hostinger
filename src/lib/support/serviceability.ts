/**
 * Pincode serviceability — the shape of an answer, and the pure parts.
 *
 * Client-safe. The lookup itself is `serviceability-server.ts`, which reads
 * `serviceable_pincodes`. This replaced a development stand-in that decided
 * coverage from the digit sum of the pincode.
 *
 * Three answers, and they are not two:
 *
 *  - **confirmed, serviceable** — the pincode is listed and active.
 *  - **confirmed, not serviceable** — listed and switched off: we have decided
 *    we do not deliver there. The only answer that refuses an order.
 *  - **unconfirmed** — not listed. Most of India is reachable by courier, so
 *    this is a "usually N days, confirmed after you order", not a refusal.
 */
export interface ServiceabilityResult {
  serviceable: boolean;
  /** True when the answer comes from our coverage list, not the default. */
  confirmed: boolean;
  pincode: string;
  city?: string;
  state?: string;
  /** Working days until delivery. */
  deliveryDays: number;
  codAvailable: boolean;
  installationDays: number;
  message: string;
}

/**
 * Working days quoted for a pincode that is not on the coverage list:
 * 7–10 working days (D-04, decided 28 Oct). `DEFAULT_DELIVERY_DAYS` is the
 * upper end, used for the "deliver by" date.
 */
export const DELIVERY_DAYS_MIN = 7;
export const DEFAULT_DELIVERY_DAYS = 10;

export const PINCODE_ERROR = 'Enter a valid 6-digit pincode.';

export function isPincode(raw: string): boolean {
  return /^[1-9]\d{5}$/.test(raw.trim());
}

/**
 * The date `workingDays` working days from `from`, skipping Sundays. Public
 * holidays are not modelled, which is why the page says "by" a date, not "on".
 */
export function deliveryDateAfter(workingDays: number, from = new Date()): Date {
  const date = new Date(from);
  let remaining = workingDays;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) remaining -= 1;
  }
  return date;
}

export function serviceabilityMessage(result: Omit<ServiceabilityResult, 'message'>): string {
  if (!result.serviceable) {
    return 'We do not deliver to this pincode yet. Call us and we will tell you the nearest serviceable area.';
  }
  const place = result.city ? ` to ${result.city}` : '';
  return result.confirmed
    ? `Delivery${place} in ${result.deliveryDays}–${result.deliveryDays + 1} working days.`
    : `Delivery usually takes ${Math.min(DELIVERY_DAYS_MIN, result.deliveryDays)}–${result.deliveryDays} working days. We confirm the date after you order.`;
}
