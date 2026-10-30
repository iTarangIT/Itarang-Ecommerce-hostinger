import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { fetchEmiPlans, lowestEmi, monthlyInstalment, parseEmiPlans, type EmiPlan } from './emi-plans';

/** The shape Razorpay documents for `/v1/methods`, trimmed to what matters. */
const METHODS = {
  entity: 'methods',
  emi: true,
  emi_subvention: 'customer',
  emi_options: {
    ICIC: [
      { duration: 3, interest: 13, subvention: 'customer', min_amount: 150000 },
      { duration: 12, interest: 15, subvention: 'customer', min_amount: 150000 },
    ],
    HDFC: [
      { duration: 12, interest: 14, subvention: 'customer', min_amount: 300000 },
      { duration: 24, interest: 16, subvention: 'customer', min_amount: 5000000 },
    ],
  },
};

describe('monthlyInstalment', () => {
  it('matches the reducing-balance figure a bank quotes', () => {
    // ₹1,00,000 over 12 months at 12% a year is ₹8,884.88 a month.
    expect(monthlyInstalment(10_000_000, 12, 12) / 100).toBeCloseTo(8884.88, 2);
  });

  it('splits the principal evenly at a zero rate', () => {
    expect(monthlyInstalment(1_200_000, 0, 12)).toBe(100_000);
  });

  it('refuses a zero-month plan', () => {
    expect(() => monthlyInstalment(100_000, 12, 0)).toThrow(RangeError);
  });
});

describe('parseEmiPlans', () => {
  it('reads every bank and tenure', () => {
    expect(parseEmiPlans(METHODS)).toEqual([
      { bank: 'ICIC', months: 3, annualRatePercent: 13, minAmount: 150000 },
      { bank: 'ICIC', months: 12, annualRatePercent: 15, minAmount: 150000 },
      { bank: 'HDFC', months: 12, annualRatePercent: 14, minAmount: 300000 },
      { bank: 'HDFC', months: 24, annualRatePercent: 16, minAmount: 5000000 },
    ]);
  });

  it('has no plans when EMI is off for the account', () => {
    expect(parseEmiPlans({ ...METHODS, emi: false })).toEqual([]);
  });

  it('skips entries it does not recognise rather than guessing', () => {
    expect(
      parseEmiPlans({
        emi_options: {
          AXIS: [{ duration: '6', interest: 14 }, { duration: 6 }, null, { duration: 6, interest: 14 }],
          KKBK: 'not a list',
        },
      }),
    ).toEqual([{ bank: 'AXIS', months: 6, annualRatePercent: 14, minAmount: 0 }]);
    expect(parseEmiPlans(null)).toEqual([]);
    expect(parseEmiPlans({ emi: true })).toEqual([]);
  });
});

describe('lowestEmi', () => {
  const plans: EmiPlan[] = parseEmiPlans(METHODS);

  it('picks the cheapest monthly figure among the plans the amount qualifies for', () => {
    // ₹25,000: the 24-month HDFC plan needs ₹50,000, so the cheapest is HDFC
    // 12 months at 14% (₹2,244.67), not ICICI 12 months at 15%.
    const quote = lowestEmi(2_500_000, plans);
    expect(quote).toEqual({ monthly: 224_500, months: 12, bank: 'HDFC' });
  });

  it('uses a longer tenure once the amount reaches its minimum', () => {
    expect(lowestEmi(6_000_000, plans)?.months).toBe(24);
  });

  it('rounds up to the rupee so the line never understates the instalment', () => {
    const quote = lowestEmi(2_500_000, plans)!;
    expect(quote.monthly % 100).toBe(0);
    expect(quote.monthly).toBeGreaterThanOrEqual(monthlyInstalment(2_500_000, 14, 12));
  });

  it('offers nothing below every bank minimum, or with no plans', () => {
    expect(lowestEmi(100_000, plans)).toBeNull();
    expect(lowestEmi(2_500_000, [])).toBeNull();
  });
});

describe('fetchEmiPlans', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    resetEnvCache();
    vi.unstubAllGlobals();
  });

  it('never asks Razorpay unless the live provider is configured', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    for (const provider of ['mock', 'razorpay-test']) {
      process.env.PAYMENT_PROVIDER = provider;
      process.env.RAZORPAY_KEY_ID = provider === 'mock' ? '' : 'rzp_test_abc';
      process.env.RAZORPAY_KEY_SECRET = 'secret';
      process.env.RAZORPAY_WEBHOOK_SECRET = 'secret';
      resetEnvCache();
      expect(await fetchEmiPlans()).toEqual([]);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads the live plans with the public key id, and fails soft', async () => {
    process.env.PAYMENT_PROVIDER = 'razorpay';
    process.env.RAZORPAY_KEY_ID = 'rzp_live_abc';
    process.env.RAZORPAY_KEY_SECRET = 'secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'secret';
    resetEnvCache();

    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(METHODS), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    expect(await fetchEmiPlans()).toHaveLength(4);
    expect(String(fetchSpy.mock.calls[0]![0])).toBe('https://api.razorpay.com/v1/methods?key_id=rzp_live_abc');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchEmiPlans()).toEqual([]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    expect(await fetchEmiPlans()).toEqual([]);
  });
});
