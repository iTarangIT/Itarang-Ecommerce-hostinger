import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileText, FlaskConical } from 'lucide-react';
import {
  cancelAndRefundAction,
  emailInvoiceAction,
  notifyStockDelayAction,
} from '@/lib/admin/actions';
import { paymentProvider } from '@/lib/payments';
import { sendPaymentLinkAction } from '@/lib/admin/staff-order-actions';
import { REFUND_REFUSAL_MESSAGES, refundRefusal, refundableAmount } from '@/lib/orders/refund-rules';
import { canInvoice, findInvoiceMeta } from '@/lib/orders/invoices';
import { orders } from '@/lib/orders/postgres-repository';
import { eventLabel } from '@/lib/orders/tracking';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/admin/status-pill';
import { OrderStatusPanel } from '@/components/admin/order-status-panel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order detail',
  robots: { index: false, follow: false },
};

export default async function AdminOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const { orderNumber } = await params;
  const { notice } = await searchParams;
  const repository = orders();
  const order = await repository.findByOrderNumber(normaliseOrderNumber(orderNumber));
  if (!order) notFound();

  const [events, payments, reservations, invoice, refunds] = await Promise.all([
    repository.listEvents(order.id),
    repository.listPayments(order.id),
    repository.listReservations(order.id),
    findInvoiceMeta(order.id),
    repository.listRefunds(order.id),
  ]);
  const refusal = refundRefusal(order, refunds, paymentProvider().id);
  const refundable = refundableAmount(order, refunds);
  // Online payments only; a COD order has nothing to refund through the gateway.
  const showRefunds =
    order.paymentMethod !== 'cod' && (order.paymentStatus === 'paid' || refunds.length > 0);
  const invoiceAllowed = canInvoice(order);
  const invoiceHref = `/api/admin/orders/${encodeURIComponent(order.orderNumber)}/invoice`;

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All orders
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="tabular heading-2">{order.orderNumber}</h1>
        <StatusPill kind="order" value={order.status} />
        <StatusPill kind="payment" value={order.paymentStatus} />
        {order.isTest ? (
          <span className="inline-flex items-center gap-1 rounded-sm bg-warning-soft px-2 py-1 text-2xs font-bold uppercase text-warning">
            <FlaskConical className="h-3 w-3" />
            Test order
          </span>
        ) : null}
        {order.placedBy ? (
          <span className="rounded-sm bg-secondary px-2 py-1 text-2xs font-bold uppercase text-muted-foreground">
            Placed by staff · {order.placedBy}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
      {notice ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm font-medium text-foreground">
          {notice}
        </p>
      ) : null}

      {order.cancellationRequest && order.status !== 'cancelled' ? (
        <p className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-foreground">
          <strong className="font-semibold">The customer asked to cancel</strong> on{' '}
          {formatDate(order.cancellationRequest.requestedAt)}
          {order.cancellationRequest.note ? ` — “${order.cancellationRequest.note}”` : ''}. Call them on{' '}
          <span className="tabular">{order.contact.phone}</span>, then use Cancel and refund below.
        </p>
      ) : null}

      {order.placedBy && !order.paymentLink && order.status === 'pending_payment' ? (
        <form
          action={sendPaymentLinkAction}
          className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm"
        >
          <input type="hidden" name="orderNumber" value={order.orderNumber} />
          <span className="text-foreground">No payment link has gone to the customer yet.</span>
          <Button type="submit" variant="outline" size="sm">
            Send payment link
          </Button>
        </form>
      ) : null}

      {order.paymentLink && order.status === 'pending_payment' ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-foreground">
          Payment link sent to the customer:{' '}
          <a
            href={order.paymentLink.url}
            target="_blank"
            rel="noopener"
            className="break-all font-medium underline underline-offset-2"
          >
            {order.paymentLink.url}
          </a>
          . The order confirms by itself when it is paid.
        </p>
      ) : null}

      {/* First on every screen size: the next step, stage dates and what they mean. */}
      <OrderStatusPanel order={order} />

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Items */}
          <section className="rounded-lg border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 font-display text-sm font-semibold">
              Items
            </h2>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-border">
                {order.items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{item.title}</span>
                      {item.variantTitle ? (
                        <span className="block text-xs text-muted-foreground">
                          {item.variantTitle}
                        </span>
                      ) : null}
                      <span className="tabular block text-xs text-muted-foreground">
                        SKU {item.sku} · variant {item.variantId}
                      </span>
                    </td>
                    <td className="tabular px-4 py-3 text-right text-muted-foreground">
                      × {item.quantity}
                    </td>
                    <td className="tabular px-4 py-3 text-right font-semibold">
                      {formatPrice(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <dl className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
              <Row label="Subtotal">{formatPrice(order.amounts.subtotal)}</Row>
              {order.amounts.couponDiscount > 0 ? (
                <Row label={`Coupon ${order.amounts.couponCode ?? ''}`}>
                  −{formatPrice(order.amounts.couponDiscount)}
                </Row>
              ) : null}
              {order.amounts.paymentDiscount > 0 ? (
                <Row label="UPI discount">−{formatPrice(order.amounts.paymentDiscount)}</Row>
              ) : null}
              <Row label="Delivery">{formatPrice(order.amounts.shipping)}</Row>
              {order.amounts.codFee > 0 ? (
                <Row label="COD fee">{formatPrice(order.amounts.codFee)}</Row>
              ) : null}
              <Row label="Total" strong>
                {formatPrice(order.amounts.total)}
              </Row>
              <Row label="GST included">{formatPrice(order.amounts.gstAmount)}</Row>
            </dl>
          </section>

          {/* Payments */}
          <section className="rounded-lg border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 font-display text-sm font-semibold">
              Payments
            </h2>
            {payments.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No payment attempts yet.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <span className="tabular text-xs">{payment.gatewayPaymentId}</span>
                    <StatusPill kind="payment" value={payment.status} />
                    <span className="text-xs text-muted-foreground">
                      {payment.provider}
                      {payment.signatureVerified ? ' · signature verified' : ' · UNVERIFIED'}
                    </span>
                    {payment.errorDescription ? (
                      <span className="w-full text-xs text-destructive">
                        {payment.errorDescription}
                      </span>
                    ) : null}
                    <span className="tabular ml-auto text-xs text-muted-foreground">
                      {formatDate(payment.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* History */}
          <section className="rounded-lg border border-border bg-card">
            <h2 className="border-b border-border px-4 py-3 font-display text-sm font-semibold">
              History
            </h2>
            <ol className="divide-y divide-border text-sm">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap gap-2 px-4 py-2.5">
                  <span className="font-medium text-foreground">
                    {eventLabel(event.fromStatus, event.toStatus)}
                  </span>
                  <span className="text-xs text-muted-foreground">by {event.actor}</span>
                  {!event.customerVisible ? (
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-2xs font-semibold uppercase text-muted-foreground">
                      Internal
                    </span>
                  ) : null}
                  {event.note ? (
                    <span className="text-xs text-muted-foreground">— {event.note}</span>
                  ) : null}
                  <span className="tabular ml-auto text-xs text-muted-foreground">
                    {formatDate(event.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6 lg:col-span-4">
          {/* R-12: cancel and refund a paid, unshipped order (D-08: any admin, up to the amount paid). */}
          {showRefunds ? (
            <section className="rounded-lg border border-border bg-card p-4 text-sm">
              <h2 className="font-display text-sm font-semibold">Cancel and refund</h2>
              {refunds.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {refunds.map((refund) => (
                    <li key={refund.id} className="rounded-md border border-border p-2 text-xs">
                      <span className="flex justify-between gap-2">
                        <span className="tabular font-semibold text-foreground">
                          {formatPrice(refund.amount)}
                        </span>
                        <span
                          className={
                            refund.status === 'processed'
                              ? 'font-semibold text-success'
                              : refund.status === 'failed'
                                ? 'font-semibold text-destructive'
                                : 'font-semibold text-warning'
                          }
                        >
                          {refund.status === 'processed'
                            ? 'Refunded'
                            : refund.status === 'failed'
                              ? 'Failed'
                              : 'Pending'}
                        </span>
                      </span>
                      <span className="mt-1 block text-muted-foreground">
                        {refund.reason} · by {refund.requestedBy} · {formatDate(refund.createdAt)}
                      </span>
                      {refund.gatewayRefundId ? (
                        <span className="tabular block text-muted-foreground">
                          {refund.gatewayRefundId}
                        </span>
                      ) : null}
                      {refund.error ? (
                        <span className="block break-words text-destructive">{refund.error}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {refusal ? (
                <p className="mt-2 text-xs text-muted-foreground">{REFUND_REFUSAL_MESSAGES[refusal]}</p>
              ) : (
                <form action={cancelAndRefundAction} className="mt-3 space-y-2">
                  <input type="hidden" name="orderNumber" value={order.orderNumber} />
                  <p className="text-xs text-muted-foreground">
                    Refunds to the original payment method through Razorpay and cancels the order,
                    which puts the stock back. Up to{' '}
                    <span className="tabular font-semibold">{formatPrice(refundable)}</span> can be
                    refunded.
                  </p>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Amount (₹)
                    <input
                      name="amount"
                      required
                      inputMode="decimal"
                      defaultValue={(refundable / 100).toFixed(2)}
                      className="tabular mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    />
                  </label>
                  <label className="block text-xs font-medium text-muted-foreground">
                    Reason
                    <input
                      name="reason"
                      required
                      maxLength={500}
                      defaultValue={order.cancellationRequest ? 'Customer asked to cancel' : undefined}
                      className="mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    />
                  </label>
                  <Button type="submit" variant="outline" fullWidth>
                    {order.status === 'cancelled' ? 'Refund' : 'Cancel and refund'}
                  </Button>
                </form>
              )}
            </section>
          ) : null}

          {/* The apology the business asked for when stock runs out. */}
          {order.status === 'confirmed' || order.status === 'packed' ? (
            <section className="rounded-lg border border-border bg-card p-4">
              <h2 className="font-display text-sm font-semibold">Out of stock?</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Emails the customer that we are sorry we could not fulfil the order on time and will
                fulfil it at the earliest. The order status does not change.
              </p>
              <form action={notifyStockDelayAction} className="mt-3">
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <Button type="submit" variant="outline" fullWidth disabled={!order.contact.email}>
                  Send delay apology
                </Button>
              </form>
            </section>
          ) : null}

          {/* Invoice: uploaded once the money is in, then emailed as a PDF. */}
          <section className="rounded-lg border border-border bg-card p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-sm font-semibold">Invoice</h2>
              {invoice?.emailedAt ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-success-soft px-2 py-0.5 text-2xs font-bold uppercase text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Sent
                </span>
              ) : invoiceAllowed && !invoice && !order.isTest ? (
                <span className="rounded-sm bg-warning-soft px-2 py-0.5 text-2xs font-bold uppercase text-warning">
                  Invoice pending
                </span>
              ) : null}
            </div>
            {!invoiceAllowed ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {order.status === 'cancelled'
                  ? 'This order is cancelled, so no invoice is issued.'
                  : order.paymentMethod === 'cod'
                    ? 'A cash-on-delivery order can be invoiced once it is delivered.'
                    : 'Available once the payment is received.'}
              </p>
            ) : (
              <>
                {invoice ? (
                  <div className="mt-2 space-y-1">
                    <a
                      href={invoiceHref}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-2"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">{invoice.fileName}</span>
                    </a>
                    {invoice.invoiceNumber ? (
                      <p className="tabular text-xs font-medium text-foreground">
                        No. {invoice.invoiceNumber}
                        {invoice.invoiceDate ? ` · dated ${invoice.invoiceDate}` : ''}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {Math.max(1, Math.round(invoice.sizeBytes / 1024))} KB · uploaded{' '}
                      {formatDate(invoice.uploadedAt)} by {invoice.uploadedBy}
                    </p>
                    {invoice.emailedAt ? (
                      <div className="!mt-3 flex items-start gap-2 rounded-md border border-success/30 bg-success-soft p-3 text-success">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">Email sent</p>
                          <p className="break-words text-xs">
                            Invoice emailed to {invoice.emailedTo} on {formatDate(invoice.emailedAt)}
                            {invoice.emailedBy ? ` by ${invoice.emailedBy}` : ''}.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not emailed yet.</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload the invoice PDF raised in Zoho or Vyapaar (up to 8 MB) with its number
                    and date, then email it to the customer.
                  </p>
                )}

                <form
                  action={invoiceHref}
                  method="post"
                  encType="multipart/form-data"
                  className="mt-3 space-y-2"
                >
                  <input
                    type="file"
                    name="file"
                    accept="application/pdf,.pdf"
                    required
                    className="block w-full text-xs file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Invoice number
                      <input
                        name="invoiceNumber"
                        required
                        maxLength={60}
                        defaultValue={invoice?.invoiceNumber}
                        className="mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                      />
                    </label>
                    <label className="block text-xs font-medium text-muted-foreground">
                      Invoice date
                      <input
                        type="date"
                        name="invoiceDate"
                        required
                        defaultValue={invoice?.invoiceDate}
                        className="mt-1 block h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                      />
                    </label>
                  </div>
                  <Button type="submit" variant="outline" fullWidth>
                    {invoice ? 'Replace invoice' : 'Upload invoice'}
                  </Button>
                </form>

                {invoice ? (
                  <form action={emailInvoiceAction} className="mt-2">
                    <input type="hidden" name="orderNumber" value={order.orderNumber} />
                    {/* Once sent, the green box above is the news; resending is a
                        secondary action, so it no longer takes the primary style. */}
                    <Button
                      type="submit"
                      variant={invoice.emailedAt ? 'outline' : 'primary'}
                      fullWidth
                      disabled={!order.contact.email}
                    >
                      {invoice.emailedAt ? 'Resend invoice' : 'Email invoice to customer'}
                    </Button>
                    {!order.contact.email ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        No email address on this order.
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </>
            )}
          </section>

          {/* Customer */}
          <section className="rounded-lg border border-border bg-card p-4 text-sm">
            <h2 className="font-display text-sm font-semibold">Customer</h2>
            <p className="mt-2 font-medium text-foreground">{order.contact.name}</p>
            <p className="tabular text-muted-foreground">{order.contact.phone}</p>
            {order.contact.email ? (
              <p className="text-muted-foreground">{order.contact.email}</p>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              {order.userId ? (
                <>Account #{order.userId} — reachable by the customer when signed in.</>
              ) : (
                // Placed before checkout required an account. It is reachable
                // only with the order number plus the phone on it, and is never
                // claimed by an account that registers later.
                <>Guest order — order number and phone only, no account attached.</>
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {order.termsAcceptedAt
                ? `Accepted terms and order updates on ${formatDate(order.termsAcceptedAt)}.`
                : 'Placed before the checkout consent tick — no consent recorded.'}
            </p>
            <address className="mt-3 not-italic text-muted-foreground">
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
              <span className="tabular">{order.shippingAddress.pincode}</span>
            </address>
            {order.buyerGstin ? (
              <p className="tabular mt-2 text-xs text-muted-foreground">
                GSTIN {order.buyerGstin}
              </p>
            ) : null}
          </section>

          {/* Reservations */}
          <section className="rounded-lg border border-border bg-card p-4 text-sm">
            <h2 className="font-display text-sm font-semibold">Stock reservations</h2>
            {reservations.length === 0 ? (
              <p className="mt-2 text-muted-foreground">None.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {reservations.map((reservation) => (
                  <li key={reservation.id} className="flex justify-between gap-2 text-xs">
                    <span className="tabular truncate">{reservation.variantId}</span>
                    <span className="shrink-0 text-muted-foreground">
                      × {reservation.quantity} · {reservation.state}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</dt>
      <dd className={`tabular ${strong ? 'font-bold text-foreground' : 'text-foreground'}`}>
        {children}
      </dd>
    </div>
  );
}
