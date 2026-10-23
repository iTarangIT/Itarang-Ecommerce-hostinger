'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronDown, FlaskConical, Loader2, MapPin, Package, Search } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import { trackView } from '@/lib/orders/tracking';
import type { OrderStages, OrderStatus, Shipment } from '@/lib/orders/types';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { OrderProgress } from '@/components/account/order-progress';
import { ShipmentDetails } from '@/components/account/shipment-details';

/**
 * The order tracker on /track, in one of two modes.
 *
 * - `owner` — a signed-in customer. No lookup form: they pick an order from
 *   their own list, which links to /track?order=<number>, and this opens it.
 *   The API matches their orders on the session, so nobody else's can open.
 * - `staff` — an admin. A "Find your order" box by order number alone; the API
 *   lets an admin read any order, so no phone number is asked.
 *
 * The order number is kept in the address bar so a refresh or a shared link
 * lands on the same order.
 */

interface TrackedOrder {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: string;
  paymentMethod: string;
  isTest: boolean;
  placedAt: string;
  total: number;
  items: Array<{ title: string; variantTitle?: string; quantity: number; lineTotal: number }>;
  shippingAddress: { city: string; state: string; pincode: string };
  contactName: string;
  stages?: OrderStages;
  shipment?: Shipment;
}

interface TrackedTimeline {
  status: string;
  note?: string;
  at: string;
}

type Result = { order: TrackedOrder; timeline: TrackedTimeline[] };

export function TrackForm({
  initialOrder = '',
  mode,
}: {
  initialOrder?: string;
  mode: 'owner' | 'staff';
}) {
  const [order, setOrder] = React.useState(initialOrder.toUpperCase());
  const [error, setError] = React.useState<string | undefined>();
  const [loading, setLoading] = React.useState(Boolean(initialOrder));
  const [problem, setProblem] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<Result | null>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);

  const lookup = React.useCallback(async (orderNumber: string) => {
    setLoading(true);
    setProblem(null);
    setResult(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`);
      if (response.status === 429) {
        setProblem('Too many tries. Please wait a few minutes and try again.');
        return false;
      }
      if (!response.ok) {
        setProblem(
          mode === 'staff'
            ? 'No order has that number. Check it and try again.'
            : 'That order is not on your account.',
        );
        return false;
      }
      setResult(await response.json());
      const url = new URL(window.location.href);
      url.searchParams.set('order', orderNumber);
      window.history.replaceState(null, '', url);
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      return true;
    } catch {
      setProblem('Could not reach the server. Check your connection and try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [mode]);

  // Arrived with ?order=: open it without asking for anything.
  const opened = React.useRef(false);
  React.useEffect(() => {
    if (opened.current || !initialOrder) return;
    opened.current = true;
    void lookup(initialOrder.toUpperCase());
  }, [initialOrder, lookup]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order.trim()) {
      setError('Enter the order number.');
      return;
    }
    setError(undefined);
    await lookup(order.trim());
  };

  const reset = () => {
    setResult(null);
    setProblem(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('order');
    window.history.replaceState(null, '', url);
  };

  if (result) {
    return <OrderResult ref={resultRef} result={result} onReset={reset} mode={mode} />;
  }

  // A customer has no form: nothing to show until they pick an order.
  if (mode === 'owner') {
    if (loading) {
      return (
        <p className="flex items-center gap-2 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening your order…
        </p>
      );
    }
    return problem ? <Problem message={problem} /> : null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="heading-3">Find an order</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Open any customer&apos;s order and see where it is — the same tracker the customer sees.
      </p>

      <form noValidate className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start" onSubmit={submit}>
        <Field
          label="Order number"
          htmlFor="order"
          required
          error={error}
          hint="For example ITG-2608-7K4QM2"
          className="flex-1"
        >
          <Input
            id="order"
            value={order}
            onChange={(e) => {
              setOrder(e.target.value.toUpperCase());
              setError(undefined);
            }}
            placeholder="ITG-…"
            className="tabular uppercase"
            autoComplete="off"
            aria-invalid={Boolean(error)}
          />
        </Field>

        <Button type="submit" variant="accent" size="lg" disabled={loading} className="sm:mt-7">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Finding…' : 'Track order'}
        </Button>
      </form>

      {problem ? <Problem message={problem} className="mt-5" /> : null}
    </div>
  );
}

function Problem({ message, className }: { message: string; className?: string }) {
  return (
    <p
      role="status"
      className={`flex items-start gap-2 rounded-lg border border-border bg-surface p-4 text-sm ${className ?? ''}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <span>
        {message}{' '}
        <Link href="/support" className="font-medium text-primary underline-offset-4 hover:underline">
          Contact support
        </Link>
      </span>
    </p>
  );
}

const OrderResult = React.forwardRef<
  HTMLDivElement,
  { result: Result; onReset: () => void; mode: 'owner' | 'staff' }
>(function OrderResult({ result, onReset, mode }, ref) {
  const { order, timeline } = result;
  const view = trackView(order.status, order.placedAt, timeline, order.stages);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div ref={ref} role="status" className="scroll-mt-24 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Order</p>
          <p className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Package className="h-5 w-5 text-accent-600" />
            <span className="tabular">{order.orderNumber}</span>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">Placed {formatDate(order.placedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          {order.isTest ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
              <FlaskConical className="h-3.5 w-3.5" />
              Test order
            </span>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onReset}>
            {mode === 'staff' ? <Search className="h-4 w-4" /> : null}
            {mode === 'staff' ? 'Track another' : 'Close'}
          </Button>
        </div>
      </div>

      <div className="mt-5">
        <OrderProgress view={view} />
      </div>

      <div className="mt-5">
        <ShipmentDetails shipment={order.shipment} />
      </div>

      <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Delivering to</dt>
          <dd className="mt-0.5 flex items-start gap-1.5 text-sm font-semibold text-foreground">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              <span className="tabular">{order.shippingAddress.pincode}</span>
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Payment</dt>
          <dd className="mt-0.5 text-sm font-semibold capitalize text-foreground">
            {order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentStatus}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total</dt>
          <dd className="tabular mt-0.5 text-sm font-semibold text-foreground">
            {formatPrice(order.total)}
          </dd>
        </div>
      </dl>

      <details className="group mt-5 rounded-lg border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} in this order
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <ul className="space-y-1.5 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          {order.items.map((item, index) => (
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
      </details>

      {/* Open by default: these are the notes the team wrote with each status
          change (courier, delay, delivery slot), and they are the answer to
          "where is my order" more often than the progress bar is. */}
      {timeline.some((entry) => entry.note) ? (
        <details open className="group mt-3 rounded-lg border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground">
            Updates from our team
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <ol className="space-y-2 border-t border-border px-4 py-3">
            {[...timeline]
              .filter((entry) => entry.note)
              .reverse()
              .map((entry, index) => (
                <li key={index} className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{formatDate(entry.at)}</span> —{' '}
                  {entry.note}
                </li>
              ))}
          </ol>
        </details>
      ) : null}

      <p className="mt-5 text-sm text-muted-foreground">
        Question about this order?{' '}
        <Link href="/support" className="font-medium text-primary underline-offset-4 hover:underline">
          Contact support
        </Link>{' '}
        and quote <span className="tabular font-medium text-foreground">{order.orderNumber}</span>.
      </p>
    </div>
  );
});
