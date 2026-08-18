import { env } from '@/lib/env';
import { MockPaymentProvider } from './mock-provider';
import { RazorpayTestProvider } from './razorpay-test-provider';
import type { PaymentProvider } from './provider';

/**
 * The single place checkout resolves a payment provider.
 *
 * Defaults to the mock. `RazorpayTestProvider` is only ever constructed when
 * `PAYMENT_PROVIDER=razorpay-test` is set explicitly, which in turn requires
 * genuine `rzp_test_` credentials — so with the current configuration no
 * Razorpay code runs and no payment request can be issued.
 */
let instance: PaymentProvider | null = null;

export function paymentProvider(): PaymentProvider {
  if (instance) return instance;

  instance =
    env().PAYMENT_PROVIDER === 'razorpay-test'
      ? new RazorpayTestProvider()
      : new MockPaymentProvider();

  return instance;
}

/** Test seam. */
export function resetPaymentProvider(): void {
  instance = null;
}

export * from './provider';
