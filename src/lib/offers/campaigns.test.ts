import { describe, expect, it } from 'vitest';
import { campaignIneligibility, describeRestrictions, isLiveOnSite, phoneKey, type Campaign } from './campaigns';
import { campaignInputSchema } from './campaign-store';
import { validateCoupon } from './coupons';
import type { CartItem } from '@/lib/store/types';

/**
 * Campaign rules, without a database. Each case is one a business user can
 * set up in /admin/campaigns.
 */

const NOW = new Date('2026-10-23T12:00:00+05:30');

function campaign(patch: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    code: 'DIWALI10',
    name: 'Diwali',
    label: '10% off',
    description: '',
    kind: 'percent',
    value: 10,
    isActive: true,
    showOnSite: true,
    startsAt: null,
    endsAt: null,
    maxRedemptionsTotal: null,
    maxPerCustomer: null,
    firstOrderOnly: false,
    cities: [],
    states: [],
    customerPhones: [],
    customerTypes: [],
    ...patch,
  };
}

describe('campaignIneligibility', () => {
  it('lets an unrestricted, active campaign through', () => {
    expect(campaignIneligibility(campaign(), { now: NOW })).toBeNull();
  });

  it('refuses a paused campaign, one not yet started and one that has ended', () => {
    expect(campaignIneligibility(campaign({ isActive: false }), { now: NOW })).toMatch(/not active/);
    expect(
      campaignIneligibility(campaign({ startsAt: new Date('2026-11-01T00:00:00+05:30') }), { now: NOW }),
    ).toMatch(/starts on/);
    expect(
      campaignIneligibility(campaign({ endsAt: new Date('2026-10-20T00:00:00+05:30') }), { now: NOW }),
    ).toMatch(/has ended/);
  });

  it('enforces the total and per-customer limits', () => {
    expect(
      campaignIneligibility(campaign({ maxRedemptionsTotal: 100 }), { now: NOW, totalRedemptions: 100 }),
    ).toMatch(/fully redeemed/);
    expect(
      campaignIneligibility(campaign({ maxPerCustomer: 1 }), { now: NOW, customerRedemptions: 1 }),
    ).toMatch(/already been used/);
    expect(
      campaignIneligibility(campaign({ maxPerCustomer: 2 }), { now: NOW, customerRedemptions: 1 }),
    ).toBeNull();
  });

  it('first order only: refused once the customer has a confirmed order', () => {
    const first = campaign({ firstOrderOnly: true });
    expect(campaignIneligibility(first, { now: NOW, hasPriorOrder: false })).toBeNull();
    expect(campaignIneligibility(first, { now: NOW, hasPriorOrder: true })).toMatch(/first order/);
  });

  it('restricts by phone, ignoring formatting', () => {
    const vip = campaign({ customerPhones: ['9876543210'] });
    expect(campaignIneligibility(vip, { now: NOW, phone: '+91 98765 43210' })).toBeNull();
    expect(campaignIneligibility(vip, { now: NOW, phone: '9000000000' })).toMatch(/not available/);
  });

  it('restricts by customer type, and an unclassified customer does not qualify', () => {
    const dealers = campaign({ customerTypes: ['dealer'] });
    expect(campaignIneligibility(dealers, { now: NOW, customerType: 'Dealer' })).toBeNull();
    expect(campaignIneligibility(dealers, { now: NOW, customerType: 'retail' })).toMatch(/not available/);
    expect(campaignIneligibility(dealers, { now: NOW, customerType: null })).toMatch(/not available/);
  });

  it('restricts by delivery state and city, case-insensitively', () => {
    const haryana = campaign({ states: ['Haryana'], cities: ['Gurugram'] });
    expect(campaignIneligibility(haryana, { now: NOW, state: 'haryana', city: 'GURUGRAM' })).toBeNull();
    expect(campaignIneligibility(haryana, { now: NOW, state: 'Delhi', city: 'Delhi' })).toMatch(/Haryana/);
    expect(campaignIneligibility(haryana, { now: NOW, state: 'Haryana', city: 'Panipat' })).toMatch(/Gurugram/);
  });

  it('defers a rule it cannot answer yet, but not once the order is final', () => {
    const strict = campaign({ firstOrderOnly: true, states: ['Haryana'], customerTypes: ['dealer'] });
    // In the cart: no address, signed out — nothing to check against yet.
    expect(campaignIneligibility(strict, { now: NOW })).toBeNull();
    // At placement every rule has to be answerable.
    expect(campaignIneligibility(strict, { now: NOW, final: true })).not.toBeNull();
  });
});

describe('isLiveOnSite and describeRestrictions', () => {
  it('lists only switched-on, listed campaigns inside their dates', () => {
    expect(isLiveOnSite(campaign(), NOW)).toBe(true);
    expect(isLiveOnSite(campaign({ showOnSite: false }), NOW)).toBe(false);
    expect(isLiveOnSite(campaign({ endsAt: new Date('2026-10-01') }), NOW)).toBe(false);
  });

  it('describes the rules in words', () => {
    expect(
      describeRestrictions(campaign({ firstOrderOnly: true, maxPerCustomer: 1, states: ['Haryana'] })),
    ).toEqual(['First order only', 'Once per customer', 'Delivery in Haryana']);
  });

  it('compares phones by their last ten digits', () => {
    expect(phoneKey('+91-98765 43210')).toBe('9876543210');
  });
});

describe('a campaign prices the cart through validateCoupon', () => {
  const item = (patch: Partial<CartItem>): CartItem =>
    ({
      id: 'p:default',
      productId: 'p',
      slug: 'p',
      title: 'Battery',
      variantTitle: '',
      image: '',
      category: 'batteries',
      subcategory: 'ev-3-wheeler',
      price: { mrp: 6_000_000, selling: 5_000_000 },
      quantity: 1,
      ...patch,
    }) as CartItem;

  it('takes a percentage off, capped by the maximum discount', () => {
    const rule = campaign({ value: 10, maxDiscount: 300_000 });
    const result = validateCoupon('diwali10', [item({})], [rule]);
    expect(result).toMatchObject({ ok: true, coupon: { code: 'DIWALI10', discount: 300_000 } });
  });

  it('only counts products in the campaign’s subcategories', () => {
    const rule = campaign({ subcategories: ['home-inverter'] });
    expect(validateCoupon('DIWALI10', [item({})], [rule])).toMatchObject({ ok: false });
  });

  it('is unknown when the campaign is not passed in', () => {
    expect(validateCoupon('DIWALI10', [item({})], [])).toMatchObject({ ok: false, reason: expect.stringMatching(/not a valid code/) });
  });
});

describe('campaignInputSchema', () => {
  const form = (patch: Record<string, unknown> = {}) => ({
    code: 'diwali10',
    name: 'Diwali',
    label: '10% off',
    kind: 'percent',
    amount: '10',
    isActive: true,
    showOnSite: false,
    firstOrderOnly: false,
    ...patch,
  });

  it('upper-cases the code and parses rupees, lists and dates', () => {
    const parsed = campaignInputSchema.parse(
      form({
        kind: 'flat',
        amount: '1,500',
        minCart: '20000',
        cities: 'Gurugram, Noida',
        customerPhones: '+91 98765 43210\n9000000001',
        startsAt: '2026-11-01T00:00',
      }),
    );
    expect(parsed).toMatchObject({
      code: 'DIWALI10',
      value: 150_000,
      minCart: 2_000_000,
      cities: ['Gurugram', 'Noida'],
      customerPhones: ['9876543210', '9000000001'],
    });
    expect(parsed.startsAt?.toISOString()).toBe('2026-10-31T18:30:00.000Z');
  });

  it('refuses a percentage above 100, an end before the start, and a short phone', () => {
    expect(campaignInputSchema.safeParse(form({ amount: '150' })).success).toBe(false);
    expect(
      campaignInputSchema.safeParse(form({ startsAt: '2026-11-02T00:00', endsAt: '2026-11-01T00:00' })).success,
    ).toBe(false);
    expect(campaignInputSchema.safeParse(form({ customerPhones: '12345' })).success).toBe(false);
  });
});
