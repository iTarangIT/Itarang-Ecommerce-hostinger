'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, FlaskConical, Loader2, Package, Search } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

/**
 * Guest order tracking.
 *
 * Both the order number and the phone number on the order are required — the
 * number alone would expose a stranger's address. A wrong phone and a
 * non-existent order return the same message, so this cannot be used to work
 * out which order numbers exist.
 */

interface TrackedOrder {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  isTest: boolean;
  placedAt: string;
  total: number;
  items: Array<{ title: string; variantTitle?: string; quantity: number; lineTotal: number }>;
  shippingAddress: { city: string; state: string; pincode: string };
  contactName: string;
}

interface TrackedTimeline {
  status: string;
  note?: string;
  at: string;
}

export function TrackForm() {
  const [order, setOrder] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [errors, setErrors] = React.useState<{ order?: string; phone?: string }>({});
  const [loading, setLoading] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);
  const [result, setResult] = React.useState<{
    order: TrackedOrder;
    timeline: TrackedTimeline[];
  } | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const next: { order?: string; phone?: string } = {};
    if (!order.trim()) next.order = 'Enter your order number.';
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = 'Enter the 10-digit mobile number on the order.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    setNotFound(false);
    setResult(null);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.trim())}?phone=${encodeURIComponent(phone)}`,
      );

      if (!response.ok) {
        setNotFound(true);
        return;
      }

      setResult(await response.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="heading-3">Find your order</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your order number is in the confirmation we sent when the order was placed.
      </p>

      <form noValidate className="mt-6 space-y-4" onSubmit={submit}>
        <Field
          label="Order number"
          htmlFor="order"
          required
          error={errors.order}
          hint="For example ITG-2608-7K4QM2"
        >
          <Input
            id="order"
            value={order}
            onChange={(e) => {
              setOrder(e.target.value.toUpperCase());
              setErrors((x) => ({ ...x, order: undefined }));
            }}
            placeholder="ITG-…"
            className="tabular uppercase"
            aria-invalid={Boolean(errors.order)}
          />
        </Field>

        <Field label="Mobile number on the order" htmlFor="phone" required error={errors.phone}>
          <Input
            id="phone"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value.replace(/\D/g, ''));
              setErrors((x) => ({ ...x, phone: undefined }));
            }}
            placeholder="10-digit mobile number"
            className="tabular"
            aria-invalid={Boolean(errors.phone)}
          />
        </Field>

        <Button type="submit" variant="accent" size="lg" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Track order
        </Button>
      </form>

      {notFound ? (
        <p
          role="status"
          className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-surface p-4 text-sm"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            No order matches that order number and mobile number. Check both and try again, or{' '}
            <Link href="/support" className="font-medium text-primary underline-offset-4 hover:underline">
              contact support
            </Link>
            .
          </span>
        </p>
      ) : null}

      {result ? (
        <div role="status" className="mt-6 rounded-lg border border-border bg-surface p-5">
          {result.order.isTest ? (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
              <FlaskConical className="h-3.5 w-3.5" />
              Test order
            </p>
          ) : null}

          <p className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <Package className="h-5 w-5 text-accent-600" />
            <span className="tabular">{result.order.orderNumber}</span>
          </p>

          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Status</dt>
              <dd className="mt-0.5 text-sm font-semibold capitalize text-foreground">
                {result.order.status.replace(/_/g, ' ')}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Payment</dt>
              <dd className="mt-0.5 text-sm font-semibold capitalize text-foreground">
                {result.order.paymentStatus}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total</dt>
              <dd className="tabular mt-0.5 text-sm font-semibold text-foreground">
                {formatPrice(result.order.total)}
              </dd>
            </div>
          </dl>

          <ul className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm text-muted-foreground">
            {result.order.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span>
                  {item.title}
                  {item.variantTitle ? ` — ${item.variantTitle}` : ''}
                  <span className="tabular"> × {item.quantity}</span>
                </span>
                <span className="tabular shrink-0">{formatPrice(item.lineTotal)}</span>
              </li>
            ))}
          </ul>

          {result.timeline.length > 0 ? (
            <ol className="mt-4 space-y-2 border-t border-border pt-4">
              {result.timeline.map((entry, index) => (
                <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  <span>
                    <span className="font-medium capitalize text-foreground">
                      {entry.status.replace(/_/g, ' ')}
                    </span>
                    {entry.note ? ` — ${entry.note}` : ''}
                    <span className="block">{formatDate(entry.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
