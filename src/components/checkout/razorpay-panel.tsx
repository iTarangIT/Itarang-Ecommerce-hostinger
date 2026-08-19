'use client';

import * as React from 'react';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/catalog/pricing';

/**
 * Razorpay Checkout, in test mode.
 *
 * The browser receives only what the server put in `clientParams` — the key id
 * and the gateway order id. `RAZORPAY_KEY_SECRET` and the webhook secret never
 * leave the server, and a tripwire test greps the built bundle to keep it that
 * way.
 *
 * Nothing the browser reports is trusted. The handler forwards Razorpay's
 * response to `/api/checkout/verify`, which recomputes the HMAC against the
 * gateway order id **stored on our own row** — so a forged handler call cannot
 * mark an order paid. The webhook is the authoritative path; this callback just
 * makes the confirmation immediate for the shopper who is still sitting there.
 */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** Razorpay's global, declared narrowly rather than pulling in their types. */
interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

let scriptPromise: Promise<void> | null = null;

/** Load Razorpay's script once per page, shared by any caller. */
function loadRazorpay(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('not a browser'));
  if (window.Razorpay) return Promise.resolve();

  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement('script');

    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new Error('Could not load the payment window.'));
    });

    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  });

  return scriptPromise;
}

export interface RazorpayIntent {
  clientParams: Record<string, string | number>;
}

export function RazorpayPanel({
  orderNumber,
  intent,
  total,
  prefill,
  busy,
  onVerified,
  onFailed,
}: {
  orderNumber: string;
  intent: RazorpayIntent;
  total: number;
  prefill: { name: string; email: string; contact: string };
  busy: boolean;
  onVerified: () => void;
  onFailed: (message: string) => void;
}) {
  const [opening, setOpening] = React.useState(false);

  const open = async () => {
    setOpening(true);
    try {
      await loadRazorpay();
      if (!window.Razorpay) throw new Error('Could not load the payment window.');

      const params = intent.clientParams;
      const checkout = new window.Razorpay({
        key: String(params.key),
        order_id: String(params.order_id),
        amount: Number(params.amount),
        currency: String(params.currency ?? 'INR'),
        name: String(params.name ?? 'iTarang Products'),
        description: `Order ${orderNumber}`,
        prefill,
        notes: { orderNumber },
        handler: async (response) => {
          try {
            const verify = await fetch('/api/checkout/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderNumber,
                gatewayOrderId: response.razorpay_order_id,
                gatewayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const data = await verify.json();

            if (verify.ok && data.paymentStatus === 'paid') {
              onVerified();
              return;
            }
            // A signature that does not verify is the interesting case: the
            // order stays unpaid and the customer is told, rather than being
            // shown a success screen for a payment we could not confirm.
            onFailed(
              data.reason === 'signature_mismatch'
                ? 'We could not verify that payment. Nothing has been charged to your order.'
                : 'The payment did not complete. Your order is still held.',
            );
          } catch {
            // The money may well have moved; the webhook will settle it.
            onFailed(
              'We could not confirm the payment just now. If it was taken, your order will ' +
                'update shortly — please do not pay again.',
            );
          } finally {
            setOpening(false);
          }
        },
        modal: { ondismiss: () => setOpening(false) },
      });

      checkout.open();
    } catch (error) {
      setOpening(false);
      onFailed((error as Error).message);
    }
  };

  return (
    <div className="mt-5 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
        <div className="min-w-0">
          <p className="font-medium">Order {orderNumber} is held for payment</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Razorpay test mode — use a test card. No real money moves. Your stock is reserved
            while you pay.
          </p>
        </div>
      </div>

      <Button
        onClick={open}
        variant="accent"
        size="lg"
        fullWidth
        className="mt-4"
        disabled={busy || opening}
      >
        {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        Pay {formatPrice(total)}
      </Button>
    </div>
  );
}
