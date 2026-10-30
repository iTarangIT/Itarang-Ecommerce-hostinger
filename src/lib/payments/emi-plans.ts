import { env } from '@/lib/env';
import type { Paise } from '@/lib/commerce/types';

/**
 * Card EMI as Razorpay offers it, for the "Card EMI from ₹x a month" line (R-16).
 *
 * The figure is the one a shopper would actually be quoted at payment, or it
 * is nothing. It is computed from the plans Razorpay itself publishes for this
 * account — per bank, per tenure, with the bank's interest rate and minimum
 * amount — using the same reducing-balance instalment a card issuer charges.
 * There is no lender agreement and no subvention (D-07), so the customer pays
 * the bank's interest and the line never says or implies otherwise — it never
 * calls the EMI free of interest.
 *
 * Only the live provider is asked. A test account's plans describe a test
 * account, and the mock has none; under either the fetch is not made and the
 * line is not shown. Any failure — network, an account with EMI switched off,
 * a response we do not recognise — is likewise an empty list, never a guess.
 */

export interface EmiPlan {
  /** Razorpay's bank code, e.g. `HDFC`, `ICIC`, `HDFC_DC` for its debit cards. */
  bank: string;
  months: number;
  /** Annual interest rate, per cent, as Razorpay states it. */
  annualRatePercent: number;
  /** The smallest amount, in paise, the bank allows this plan on. */
  minAmount: Paise;
}

export interface EmiQuote {
  /** Whole rupees in paise, rounded up so the line never understates it. */
  monthly: Paise;
  months: number;
  bank: string;
}

/**
 * The equated monthly instalment on `principal` over `months` at an annual
 * rate, reducing balance: P·r·(1+r)^n / ((1+r)^n − 1), r the monthly rate.
 * Unrounded paise; a zero rate is the principal split evenly.
 */
export function monthlyInstalment(principal: Paise, annualRatePercent: number, months: number): number {
  if (months <= 0) throw new RangeError('An EMI needs at least one month.');
  const r = annualRatePercent / 12 / 100;
  if (r === 0) return principal / months;
  const growth = (1 + r) ** months;
  return (principal * r * growth) / (growth - 1);
}

/**
 * The lowest instalment any offered plan gives on `amount`, or null when no
 * plan accepts it (every bank's minimum is above it, or there are no plans).
 *
 * The lowest is what "from ₹x" promises: it is a real plan a shopper can pick,
 * usually the longest tenure at the cheapest bank, and every other plan costs
 * more a month.
 */
export function lowestEmi(amount: Paise, plans: readonly EmiPlan[]): EmiQuote | null {
  let best: { exact: number; plan: EmiPlan } | null = null;
  for (const plan of plans) {
    if (amount < plan.minAmount || plan.months <= 0) continue;
    const exact = monthlyInstalment(amount, plan.annualRatePercent, plan.months);
    if (!best || exact < best.exact) best = { exact, plan };
  }
  if (!best) return null;
  return {
    monthly: Math.ceil(best.exact / 100) * 100,
    months: best.plan.months,
    bank: best.plan.bank,
  };
}

/**
 * Plans out of Razorpay's `/v1/methods` response.
 *
 * `emi_options` maps a bank code to its plans:
 *   { "HDFC": [{ "duration": 12, "interest": 14, "min_amount": 300000, … }] }
 * Anything that does not have that shape is skipped rather than coerced, and
 * an account with `emi: false` has no plans whatever `emi_options` holds.
 */
export function parseEmiPlans(body: unknown): EmiPlan[] {
  if (!body || typeof body !== 'object') return [];
  const methods = body as { emi?: unknown; emi_options?: unknown };
  if (methods.emi === false) return [];
  if (!methods.emi_options || typeof methods.emi_options !== 'object') return [];

  const plans: EmiPlan[] = [];
  for (const [bank, entries] of Object.entries(methods.emi_options as Record<string, unknown>)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const { duration, interest, min_amount } = entry as Record<string, unknown>;
      if (
        typeof duration !== 'number' ||
        !Number.isInteger(duration) ||
        duration <= 0 ||
        typeof interest !== 'number' ||
        interest < 0 ||
        !Number.isFinite(interest)
      ) {
        continue;
      }
      plans.push({
        bank,
        months: duration,
        annualRatePercent: interest,
        minAmount: typeof min_amount === 'number' && min_amount > 0 ? min_amount : 0,
      });
    }
  }
  return plans;
}

/** Plans change when the business changes its Razorpay settings, not by the minute. */
const REVALIDATE_SECONDS = 6 * 60 * 60;
const TIMEOUT_MS = 5_000;

/**
 * The live account's card EMI plans, cached for six hours by Next's data cache.
 *
 * The endpoint is the one Razorpay's own checkout calls, keyed by the public
 * key id — no secret is sent. Server-side only so the product page's static
 * HTML carries the result and the shopper's browser makes no extra call.
 */
export async function fetchEmiPlans(): Promise<EmiPlan[]> {
  const config = env();
  if (config.PAYMENT_PROVIDER !== 'razorpay' || !config.RAZORPAY_KEY_ID) return [];

  try {
    const response = await fetch(
      `https://api.razorpay.com/v1/methods?key_id=${encodeURIComponent(config.RAZORPAY_KEY_ID)}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        next: { revalidate: REVALIDATE_SECONDS },
      },
    );
    if (!response.ok) {
      console.error(`[emi] Razorpay methods returned ${response.status}`);
      return [];
    }
    return parseEmiPlans(await response.json());
  } catch (error) {
    console.error('[emi] could not read Razorpay EMI plans', error);
    return [];
  }
}
