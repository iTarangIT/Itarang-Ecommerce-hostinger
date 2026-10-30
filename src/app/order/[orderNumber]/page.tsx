import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, FileText, FlaskConical, RotateCcw, XCircle } from 'lucide-react';
import { orders } from '@/lib/orders/postgres-repository';
import { hasOrderAccess } from '@/lib/orders/access';
import { canInvoice, findInvoiceMeta } from '@/lib/orders/invoices';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ButtonLink } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { ReviewForm } from '@/components/product/review-form';
import { OrderProgress } from '@/components/account/order-progress';
import { ShipmentDetails } from '@/components/account/shipment-details';
import { eventLabel, trackView } from '@/lib/orders/tracking';
import { requestCancellationAction } from '@/lib/orders/customer-actions';
import { customerRefunds, refundSummary } from '@/lib/orders/refund-rules';
import { SITE } from '@/lib/site';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your order',
  robots: { index: false, follow: false },
};


export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ placed?: string; cancel?: string }>;
}) {
  const { orderNumber: raw } = await params;
  const { placed, cancel } = await searchParams;
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

  // Internal admin notes are never shown to the customer.
  const events = (await repository.listEvents(order.id)).filter((event) => event.customerVisible);
  const view = trackView(
    order.status,
    order.createdAt,
    events.map((event) => ({ status: event.toStatus, at: event.createdAt })),
    order.stages,
  );
  const awaitingPayment = order.status === 'pending_payment';
  // Reviews open once the battery has arrived; the review action still checks
  // the signed-in customer bought it.
  const canReview = order.status === 'delivered' && order.paymentStatus !== 'refunded';
  const invoice = canInvoice(order) ? await findInvoiceMeta(order.id) : null;
  const invoiceReady = Boolean(invoice);
  const refundRecords = await repository.listRefunds(order.id);
  const refund = refundSummary(refundRecords);
  const refunds = customerRefunds(refundRecords);
  const cancelled = order.status === 'cancelled';
  // Before dispatch the customer may ask to cancel; an admin then cancels and
  // refunds (R-12). Asked once — the request is shown instead of the button.
  const canRequestCancel =
    (order.status === 'confirmed' || order.status === 'packed') && !order.cancellationRequest;

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
        {cancelled ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold text-muted-foreground">
            <XCircle className="h-4 w-4" />
            Cancelled
          </span>
        ) : placed && !awaitingPayment ? (
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
          {cancelled
            ? 'Your order has been cancelled'
            : awaitingPayment
              ? 'Your order is held'
              : 'Thank you — your order is confirmed'}
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
              {order.paymentMethod === 'cod'
                ? 'Cash on delivery'
                : order.paymentMethod === 'razorpay'
                  ? 'Paid online'
                  : 'Test payment'}
              <span className="block text-xs font-normal text-muted-foreground">
                {refund
                  ? refund.state === 'processed'
                    ? `Refunded ${formatPrice(refund.amount)}`
                    : `Refund of ${formatPrice(refund.amount)} in progress — 5–7 working days`
                  : order.paymentStatus}
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

        {/* Each refund with the dates to expect the money between (R-12) —
            the timeline Razorpay states on the payment. */}
        {refunds.length > 0 ? (
          <section className="mt-6 rounded-lg border border-success/30 bg-success-soft p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
              <RotateCcw className="h-4 w-4 text-success" />
              {refunds.length === 1 ? 'Your refund' : 'Your refunds'}
            </h2>
            <ul className="mt-3 space-y-3">
              {refunds.map((line) => (
                <li key={`${line.reference ?? line.startedAt}`} className="text-sm text-foreground">
                  <p className="font-semibold">
                    {line.state === 'processed'
                      ? `${formatPrice(line.amount)} refunded on ${formatDate(line.processedAt ?? line.startedAt)}`
                      : `Refund of ${formatPrice(line.amount)} started on ${formatDate(line.startedAt)}`}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    {line.state === 'processed'
                      ? 'It will be credited to your original payment method within 5–7 working days'
                      : 'It takes 3–5 working days to process, then your bank or card issuer credits it within 5–7 working days'}{' '}
                    — expect it between{' '}
                    <span className="font-semibold text-foreground">{formatDate(line.creditFrom)}</span> and{' '}
                    <span className="font-semibold text-foreground">{formatDate(line.creditBy)}</span>.
                  </p>
                  {line.reference ? (
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">Refund reference {line.reference}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-success/20 pt-3 text-xs text-muted-foreground">
              Not received by the last date? Call{' '}
              <a href={SITE.phoneHref} className="font-semibold text-foreground underline-offset-2 hover:underline">
                {SITE.phone}
              </a>{' '}
              or write to{' '}
              <a href={`mailto:${SITE.email}`} className="font-semibold text-foreground underline-offset-2 hover:underline">
                {SITE.email}
              </a>{' '}
              with the refund reference — your bank can trace the credit with it.
            </p>
          </section>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        {/* Items */}
        <section className="lg:col-span-7">
          <h2 className="heading-3">What you ordered</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
            {order.items.map((item) => (
              <li key={`${item.variantId}`} className="p-4">
                <div className="flex gap-3">
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
                </div>
                {canReview ? (
                  <div className="mt-3">
                    <ReviewForm
                      productKey={item.productId}
                      productPath={`/order/${order.orderNumber}`}
                      label="Rate & review this product"
                    />
                  </div>
                ) : null}
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
            {order.amounts.paymentDiscount > 0 ? (
              <Row label="UPI discount">−{formatPrice(order.amounts.paymentDiscount)}</Row>
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
            {invoiceReady ? (
              <a
                href={`/api/orders/${encodeURIComponent(order.orderNumber)}/invoice`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-2 hover:underline"
              >
                <FileText className="h-4 w-4" />
                Download invoice
                {invoice?.invoiceNumber ? ` ${invoice.invoiceNumber}` : ''}
              </a>
            ) : canInvoice(order) && !order.isTest ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Your GST invoice will appear here once it is issued.
              </p>
            ) : null}
          </div>
        </section>

        {/* Status + address */}
        <aside className="lg:col-span-5">
          <h2 className="heading-3">Progress</h2>
          {/* The same five steps, with dates, as /track. */}
          <div className="mt-4 rounded-lg border border-border bg-card p-5">
            <OrderProgress view={view} />
          </div>

          <div className="mt-4">
            <ShipmentDetails shipment={order.shipment} />
          </div>

          {cancelled ? null : order.cancellationRequest || cancel === 'requested' ? (
            <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-foreground">
              <strong className="font-semibold">Cancellation requested.</strong> We will call you on{' '}
              <span className="tabular">{order.contact.phone}</span> within one working day. If the order has not
              been dispatched it is cancelled and any amount paid is refunded to the original payment method.
            </p>
          ) : canRequestCancel ? (
            <details className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">
              <summary className="cursor-pointer font-semibold text-foreground">
                Request cancellation
              </summary>
              <form action={requestCancellationAction} className="mt-3 space-y-2">
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <label className="block text-xs font-medium text-muted-foreground">
                  Reason (optional)
                  <textarea
                    name="note"
                    maxLength={500}
                    rows={2}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  You can cancel free of charge until the order is dispatched. We will call you to confirm.
                </p>
                <Button type="submit" variant="outline" size="sm">
                  Request cancellation
                </Button>
              </form>
            </details>
          ) : cancel === 'unavailable' ? (
            <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
              This order can no longer be cancelled online. Call customer care and we will help.
            </p>
          ) : null}

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
            <details open className="mt-4 rounded-lg border border-border bg-surface p-4">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">
                Order history
              </summary>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {events.map((event) => (
                  <li key={event.id} className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium text-foreground">
                        {eventLabel(event.fromStatus, event.toStatus)}
                      </span>
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
