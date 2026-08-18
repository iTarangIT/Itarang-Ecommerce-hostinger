import type { Offer } from '../types';

/**
 * Development offer fixtures.
 *
 * These describe the *shape* of the offer engine — bank, UPI, EMI, coupon,
 * shipping and bundle offers — so the UI can be built against it. Terms are
 * illustrative and must be replaced with signed commercial terms before any of
 * this is published.
 */
export const OFFERS: Offer[] = [
  {
    id: 'off-upi-1',
    kind: 'upi',
    title: 'Save 1% on UPI payments',
    detail: 'Instant 1% discount when you pay by UPI at checkout, up to ₹500 per order.',
    termsUrl: '/offers#upi',
  },
  {
    id: 'off-emi-1',
    kind: 'emi',
    title: 'No-cost EMI from ₹5,000',
    detail:
      'Three, six and nine month no-cost EMI on major credit cards for orders above ₹5,000. Processing fee, where applicable, is shown before you confirm.',
    minCart: 500000,
    termsUrl: '/offers#emi',
  },
  {
    id: 'off-bank-1',
    kind: 'bank',
    title: '10% instant discount on select bank cards',
    detail:
      'Up to ₹2,500 off on eligible credit card EMI transactions above ₹10,000. One redemption per card per month.',
    minCart: 1000000,
    termsUrl: '/offers#bank',
  },
  {
    id: 'off-ship-1',
    kind: 'shipping',
    title: 'Free delivery above ₹4,999',
    detail:
      'Standard delivery is free on orders above ₹4,999. Batteries ship in protective crates at no extra charge.',
    minCart: 499900,
    termsUrl: '/offers#delivery',
  },
  {
    id: 'off-coupon-combo',
    kind: 'coupon',
    title: '₹1,500 off inverter + battery combos',
    detail:
      'Applies to any combo above ₹20,000. Cannot be combined with the bank card instant discount.',
    code: 'COMBO1500',
    categories: ['combos'],
    minCart: 2000000,
    endsAt: '2026-09-30T18:29:59.000Z',
    termsUrl: '/offers#coupons',
  },
  {
    id: 'off-coupon-lithium',
    kind: 'coupon',
    title: '₹2,000 off lithium batteries',
    detail: 'Applies to any iTarang LiFe series battery bought on its own.',
    code: 'LIFE2000',
    categories: ['batteries'],
    endsAt: '2026-09-15T18:29:59.000Z',
    termsUrl: '/offers#coupons',
  },
  {
    id: 'off-bundle-1',
    kind: 'bundle',
    title: 'Buy inverter and battery together and save',
    detail:
      'Every iTarang combo is priced below the sum of its parts, and ships with one warranty and one installation visit.',
    categories: ['combos'],
    termsUrl: '/c/combos',
  },
];

/** Offers surfaced in the PDP offer stack for a given category. */
export function offersForCategory(category: string): Offer[] {
  return OFFERS.filter(
    (o) => !o.categories || o.categories.length === 0 || o.categories.includes(category as never),
  );
}
