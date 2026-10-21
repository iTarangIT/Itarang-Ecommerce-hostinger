/**
 * Who a customer calls, for what.
 *
 * The business asked for three things here ("Website changes", Oct 2026):
 * Trontek's own complaint number and service email, iTarang's grievance
 * officer (Chirag Garg), and *two* warranty numbers — one for Trontek, one for
 * iTarang — because a warranty claim can be raised with either.
 *
 * iTarang's figures are the seller record's (`db/seed/trontek-shared.ts`), the
 * same number every product page prints. **Trontek's service number and email
 * are not in any document we hold.** The listing sheets give only a head-office
 * line and `info@trontek.com`, which is not a service desk. They are `null`
 * until the business supplies them, and every surface that reads them renders
 * nothing for a `null` rather than a guess — fill them in here and they appear
 * everywhere at once.
 */

export interface ContactLine {
  label: string;
  /** Display form, e.g. "99710 27907". */
  phone: string | null;
  email: string | null;
  /** Who answers, when that is a named person. */
  person?: string;
  note?: string;
}

/** `tel:` link for a display phone number, or null. */
export function telHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  return `tel:+91${digits.slice(-10)}`;
}

export const ITARANG_CARE: ContactLine = {
  label: 'iTarang customer care',
  phone: '99710 27907',
  // `customerCareEmail` is unconfirmed in the seller record; `SITE.email` is the
  // address the site already publishes for support.
  email: 'care@itarang.com',
  note: 'Orders, delivery, returns and refunds.',
};

export const TRONTEK_SERVICE: ContactLine = {
  label: 'Trontek service desk',
  /** Business to supply — Trontek's customer complaint number. */
  phone: null,
  /** Business to supply — Trontek's service email. */
  email: null,
  note: 'Product faults and warranty service, direct with the manufacturer.',
};

export const GRIEVANCE_OFFICER: ContactLine = {
  label: 'Grievance officer',
  person: 'Chirag Garg',
  phone: '99710 27907',
  email: 'care@itarang.com',
  note: 'iTarang Network Private Limited, Unitech Business Zone, Sector 50, Gurugram, Haryana.',
};

/**
 * The two warranty numbers, Trontek's first. A line with no phone and no email
 * is left out, so until Trontek's details arrive only iTarang's shows.
 */
export const WARRANTY_CONTACTS: ContactLine[] = [
  { ...TRONTEK_SERVICE, label: 'Trontek (manufacturer)' },
  { ...ITARANG_CARE, label: 'iTarang (seller)' },
].filter((line) => line.phone || line.email);

/** Grievances are acknowledged within this many hours and resolved within a month. */
export const GRIEVANCE_ACK_HOURS = 48;
export const GRIEVANCE_RESOLVE_DAYS = 30;
