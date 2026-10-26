import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FileText, FlaskConical } from 'lucide-react';
import { emailInvoiceAction, notifyStockDelayAction } from '@/lib/admin/actions';
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

  const [events, payments, reservations, invoice] = await Promise.all([
    repository.listEvents(order.id),
    repository.listPayments(order.id),
    repository.listReservations(order.id),
    findInvoiceMeta(order.id),
  ]);
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
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
      {notice ? (
        <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm font-medium text-foreground">
          {notice}
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
            <h2 className="font-display text-sm font-semibold">Invoice</h2>
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
                    <p className="text-xs text-muted-foreground">
                      {Math.max(1, Math.round(invoice.sizeBytes / 1024))} KB · uploaded{' '}
                      {formatDate(invoice.uploadedAt)} by {invoice.uploadedBy}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.emailedAt
                        ? `Emailed to ${invoice.emailedTo} on ${formatDate(invoice.emailedAt)}`
                        : 'Not emailed yet.'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Upload the invoice PDF (up to 10 MB), then email it to the customer.
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
                  <Button type="submit" variant="outline" fullWidth>
                    {invoice ? 'Replace invoice' : 'Upload invoice'}
                  </Button>
                </form>

                {invoice ? (
                  <form action={emailInvoiceAction} className="mt-2">
                    <input type="hidden" name="orderNumber" value={order.orderNumber} />
                    <Button type="submit" fullWidth disabled={!order.contact.email}>
                      {invoice.emailedAt ? 'Email invoice again' : 'Email invoice to customer'}
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
