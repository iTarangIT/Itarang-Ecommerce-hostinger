import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, FlaskConical, MapPin, Package, Truck } from 'lucide-react';
import { orders } from '@/lib/orders/postgres-repository';
import { hasOrderAccess } from '@/lib/orders/access';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import type { OrderStatus } from '@/lib/orders/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your order',
  robots: { index: false, follow: false },
};

const TIMELINE: Array<{ status: OrderStatus; label: string; icon: typeof Package }> = [
  { status: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'packed', label: 'Packed', icon: Package },
  { status: 'shipped', label: 'Shipped', icon: Truck },
  { status: 'delivered', label: 'Delivered', icon: MapPin },
];

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { orderNumber: raw } = await params;
  const { placed } = await searchParams;
  const orderNumber = normaliseOrderNumber(raw);

  // Only the browser that placed this order may see it without a phone number.
  if (!(await hasOrderAccess(orderNumber))) {
    return (
      <div className="container py-16">
        <StateBlock
          title="Sign in to this order"
          description="For your privacy an order can only be opened from the device that placed it, or by entering the mobile number on the order."
          actions={
            <>
              <ButtonLink href="/track" variant="primary">
                Track with your mobile number
              </ButtonLink>
              <ButtonLink href="/" variant="outline">
                Go to the homepage
              </ButtonLink>
            </>
          }
        />
      </div>
    );
  }

  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) notFound();

  const events = await repository.listEvents(order.id);
  const currentIndex = TIMELINE.findIndex((entry) => entry.status === order.status);
  const awaitingPayment = order.status === 'pending_payment';

  return (
    <div className="container py-6 lg:py-10">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: `Order ${order.orderNumber}` }]} />

      {order.isTest ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <strong className="font-semibold text-foreground">Test order</strong> — placed in test
            mode against a local database. No payment was taken and nothing will be dispatched.
          </span>
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-border bg-card p-6 sm:p-8">
        {placed && !awaitingPayment ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-success">
            <CheckCircle2 className="h-4 w-4" />
            Order placed
          </span>
        ) : awaitingPayment ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-warning-soft px-3 py-1.5 text-sm font-semibold text-warning">
            <Clock className="h-4 w-4" />
            Awaiting payment
          </span>
        ) : null}

        <h1 className="heading-1 mt-4">
          {awaitingPayment ? 'Your order is held' : 'Thank you — your order is confirmed'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Order number{' '}
          <span className="tabular font-semibold text-foreground">{order.orderNumber}</span> ·
          placed {formatDate(order.createdAt)}
        </p>

        <dl className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Total</dt>
            <dd className="tabular mt-1 font-display text-lg font-bold text-foreground">
              {formatPrice(order.amounts.total)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Payment</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Test payment'}
              <span className="block text-xs font-normal text-muted-foreground">
                {order.paymentStatus}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Delivering to</dt>
            <dd className="mt-1 text-sm text-foreground">
              {order.contact.name}
              <span className="block text-xs text-muted-foreground">
                {order.shippingAddress.city}, {order.shippingAddress.pincode}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Items */}
        <section className="lg:col-span-7">
          <h2 className="heading-3">What you ordered</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {order.items.map((item) => (
              <li key={`${item.variantId}`} className="flex gap-3 p-4">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                  {item.image ? (
                    <Image src={item.image} alt="" fill sizes="64px" className="object-contain p-1" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                  {item.variantTitle ? (
                    <span className="block text-xs text-muted-foreground">{item.variantTitle}</span>
                  ) : null}
                  <span className="tabular mt-1 block text-xs text-muted-foreground">
                    SKU {item.sku} · qty {item.quantity}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-bold text-foreground">
                  {formatPrice(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
            <Row label="Subtotal">{formatPrice(order.amounts.subtotal)}</Row>
            {order.amounts.couponDiscount > 0 ? (
              <Row label={`Coupon ${order.amounts.couponCode ?? ''}`}>
                −{formatPrice(order.amounts.couponDiscount)}
              </Row>
            ) : null}
            <Row label="Delivery">
              {order.amounts.shipping === 0 ? 'Free' : formatPrice(order.amounts.shipping)}
            </Row>
            {order.amounts.codFee > 0 ? (
              <Row label="Cash on delivery fee">{formatPrice(order.amounts.codFee)}</Row>
            ) : null}
            <div className="mt-2 flex justify-between border-t border-border pt-2 font-display text-base font-bold">
              <span>Total</span>
              <span className="tabular">{formatPrice(order.amounts.total)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Inclusive of {formatPrice(order.amounts.gstAmount)} GST
              {order.buyerGstin ? ` · GSTIN ${order.buyerGstin}` : ''}
            </p>
          </div>
        </section>

        {/* Status + address */}
        <aside className="lg:col-span-5">
          <h2 className="heading-3">Progress</h2>
          <ol className="mt-4 rounded-lg border border-border bg-card p-5">
            {TIMELINE.map((entry, index) => {
              const reached = currentIndex >= index && currentIndex !== -1;
              return (
                <li key={entry.status} className="relative flex gap-4 pb-6 last:pb-0">
                  {index < TIMELINE.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[0.9375rem] top-8 h-full w-px ${
                        currentIndex > index ? 'bg-success' : 'bg-border'
                      }`}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                      reached
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <entry.icon className="h-4 w-4" />
                  </span>
                  <span className="pt-1">
                    <span
                      className={`block text-sm font-semibold ${
                        reached ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {entry.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          <h2 className="heading-3 mt-6">Delivery address</h2>
          <address className="mt-3 rounded-lg border border-border bg-card p-4 text-sm not-italic text-muted-foreground">
            <span className="block font-semibold text-foreground">{order.contact.name}</span>
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? <>, {order.shippingAddress.line2}</> : null}
            <br />
            {order.shippingAddress.landmark ? (
              <>
                {order.shippingAddress.landmark}
                <br />
              </>
            ) : null}
            {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
            <span className="tabular">{order.shippingAddress.pincode}</span>
            <br />
            <span className="tabular">{order.contact.phone}</span>
          </address>

          {events.length > 0 ? (
            <details className="mt-4 rounded-lg border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Order history
              </summary>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {events.map((event) => (
                  <li key={event.id} className="flex justify-between gap-3">
                    <span>
                      {event.toStatus}
                      {event.note ? ` — ${event.note}` : ''}
                    </span>
                    <span className="tabular shrink-0">{formatDate(event.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <ButtonLink href="/track" variant="outline" size="sm">
              Track this order
            </ButtonLink>
            <Link
              href="/support"
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Need help?
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular font-medium text-foreground">{children}</span>
    </div>
  );
}
