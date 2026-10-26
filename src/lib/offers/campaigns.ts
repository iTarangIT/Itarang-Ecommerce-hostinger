import type { CouponRule } from './coupons';
import { sameCity } from '@/lib/geo/city-names';

/**
 * Coupon campaigns: a coupon rule plus who may use it and when.
 *
 * Pure — no database — so every eligibility rule is unit-tested. The rows come
 * from `campaign-store.ts` (table `campaigns`, migration 0025), edited at
 * /admin/campaigns. What a code takes off the cart is still decided by
 * `validateCoupon` in `coupons.ts`; this file decides whether this customer,
 * at this moment, delivering here, may use it at all.
 */

export const CUSTOMER_TYPES = ['retail', 'dealer', 'fleet', 'institutional'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export interface Campaign extends CouponRule {
  id: number;
  name: string;
  isActive: boolean;
  showOnSite: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  /** Uses across all customers; null = unlimited. */
  maxRedemptionsTotal: number | null;
  /** Uses per customer (account or phone); null = unlimited. */
  maxPerCustomer: number | null;
  firstOrderOnly: boolean;
  /** Empty = no restriction. Compared case-insensitively. */
  cities: string[];
  states: string[];
  /** Ten-digit mobile numbers. Empty = everyone. */
  customerPhones: string[];
  customerTypes: string[];
}

/**
 * What is known about the shopper when a code is checked.
 *
 * A field left `undefined` is *not yet known* — the cart has no delivery
 * address, a signed-out visitor has no order history — and its rule is
 * skipped, unless `final` is set. Order placement sets `final`, so by then
 * every rule must be answerable or the code is refused.
 */
export interface EligibilityContext {
  now: Date;
  final?: boolean;
  city?: string;
  state?: string;
  phone?: string;
  customerType?: string | null;
  /** The customer already has a confirmed or paid order. */
  hasPriorOrder?: boolean;
  /** Live redemptions of this code by this customer (account or phone). */
  customerRedemptions?: number;
  /** Live redemptions of this code by everyone. */
  totalRedemptions?: number;
}

/** The last ten digits, so "+91 98765 43210" and "9876543210" match. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** "A, B, C and 12 more" — a campaign can name every city in a state. */
function placeList(places: string[]): string {
  const shown = places.slice(0, 5).join(', ');
  return places.length > 5 ? `${shown} and ${places.length - 5} more` : shown;
}

const dateLabel = (date: Date) =>
  date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/**
 * Why this campaign cannot be used, or null when it can.
 *
 * Checked in a fixed order — switched off, dates, limits, then who and where —
 * so the message names the first thing the shopper could not change.
 */
export function campaignIneligibility(campaign: Campaign, context: EligibilityContext): string | null {
  const code = campaign.code;
  const unknown = (value: unknown) => value === undefined && !context.final;

  if (!campaign.isActive) return `${code} is not active at the moment.`;
  if (campaign.startsAt && context.now < campaign.startsAt) {
    return `${code} starts on ${dateLabel(campaign.startsAt)}.`;
  }
  if (campaign.endsAt && context.now >= campaign.endsAt) return `${code} has ended.`;

  if (campaign.maxRedemptionsTotal !== null && !unknown(context.totalRedemptions)) {
    if ((context.totalRedemptions ?? 0) >= campaign.maxRedemptionsTotal) {
      return `${code} has been fully redeemed.`;
    }
  }
  if (campaign.maxPerCustomer !== null && !unknown(context.customerRedemptions)) {
    if ((context.customerRedemptions ?? 0) >= campaign.maxPerCustomer) {
      return campaign.maxPerCustomer === 1
        ? `${code} has already been used on a previous order.`
        : `${code} can be used ${campaign.maxPerCustomer} times per customer, and you have used it already.`;
    }
  }

  if (campaign.firstOrderOnly && !unknown(context.hasPriorOrder)) {
    if (context.hasPriorOrder !== false) return `${code} is only for your first order.`;
  }

  if (campaign.customerPhones.length > 0 && !unknown(context.phone)) {
    const key = context.phone ? phoneKey(context.phone) : '';
    if (!campaign.customerPhones.some((phone) => phoneKey(phone) === key)) {
      return `${code} is not available on this account.`;
    }
  }

  if (campaign.customerTypes.length > 0 && !unknown(context.customerType)) {
    const type = context.customerType ?? '';
    if (!campaign.customerTypes.some((allowed) => same(allowed, type))) {
      return `${code} is not available on this account.`;
    }
  }

  if (campaign.states.length > 0 && !unknown(context.state)) {
    if (!campaign.states.some((state) => same(state, context.state ?? ''))) {
      return `${code} applies only to deliveries in ${placeList(campaign.states)}.`;
    }
  }
  if (campaign.cities.length > 0 && !unknown(context.city)) {
    if (!campaign.cities.some((city) => sameCity(city, context.city ?? ''))) {
      return `${code} applies only to deliveries in ${placeList(campaign.cities)}.`;
    }
  }

  return null;
}

/** Shown on the site right now: switched on, listed, and inside its dates. */
export function isLiveOnSite(campaign: Campaign, now: Date): boolean {
  return (
    campaign.isActive &&
    campaign.showOnSite &&
    (!campaign.startsAt || campaign.startsAt <= now) &&
    (!campaign.endsAt || now < campaign.endsAt)
  );
}

/** The campaign's rules in one line, for the admin list and the offers page. */
export function describeRestrictions(campaign: Campaign): string[] {
  const parts: string[] = [];
  if (campaign.firstOrderOnly) parts.push('First order only');
  if (campaign.maxPerCustomer !== null) {
    parts.push(campaign.maxPerCustomer === 1 ? 'Once per customer' : `${campaign.maxPerCustomer} uses per customer`);
  }
  if (campaign.maxRedemptionsTotal !== null) parts.push(`First ${campaign.maxRedemptionsTotal} orders`);
  if (campaign.states.length > 0) parts.push(`Delivery in ${placeList(campaign.states)}`);
  if (campaign.cities.length > 0) parts.push(`Delivery in ${placeList(campaign.cities)}`);
  if (campaign.products?.length) {
    parts.push(`${campaign.products.length} selected product${campaign.products.length === 1 ? '' : 's'}`);
  }
  if (campaign.customerTypes.length > 0) parts.push(`For ${campaign.customerTypes.join(', ')} customers`);
  if (campaign.customerPhones.length > 0) parts.push('Selected customers only');
  if (campaign.endsAt) parts.push(`Until ${dateLabel(campaign.endsAt)}`);
  return parts;
}
