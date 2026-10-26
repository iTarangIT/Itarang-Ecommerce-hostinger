import { env } from '@/lib/env';
import { MockPaymentProvider } from './mock-provider';
import { RazorpayTestProvider } from './razorpay-test-provider';
import type { PaymentProvider } from './provider';

/**
 * The single place checkout resolves a payment provider.
 *
 * Defaults to the mock. `RazorpayTestProvider` is only ever constructed when
 * `PAYMENT_PROVIDER` is explicitly `razorpay-test` (needs `rzp_test_` keys) or
 * `razorpay` (needs `rzp_live_` keys and takes real money).
 */
let instance: PaymentProvider | null = null;

export function paymentProvider(): PaymentProvider {
  if (instance) return instance;

  instance =
    env().PAYMENT_PROVIDER === 'mock'
      ? new MockPaymentProvider()
      : new RazorpayTestProvider();

  return instance;
}

/** Test seam. */
export function resetPaymentProvider(): void {
  instance = null;
}

export * from './provider';
