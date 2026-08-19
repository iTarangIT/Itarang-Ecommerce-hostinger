import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { updateOrderStatusAction } from '@/lib/admin/actions';
import { orders } from '@/lib/orders/postgres-repository';
import { nextOrderStatuses } from '@/lib/orders/state-machine';
import { normaliseOrderNumber } from '@/lib/orders/numbering';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/admin/status-pill';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order detail',
  robots: { index: false, follow: false },
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const repository = orders();
  const order = await repository.findByOrderNumber(normaliseOrderNumber(orderNumber));
  if (!order) notFound();

  const [events, payments, reservations] = await Promise.all([
    repository.listEvents(order.id),
    repository.listPayments(order.id),
    repository.listReservations(order.id),
  ]);

  const transitions = nextOrderStatuses(order.status);

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
                    {event.fromStatus ? `${event.fromStatus} → ` : ''}
                    {event.toStatus}
                  </span>
                  <span className="text-xs text-muted-foreground">by {event.actor}</span>
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
          {/* Fulfilment */}
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-display text-sm font-semibold">Move this order on</h2>
            {transitions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                This order is in a final state.
              </p>
            ) : (
              <form action={updateOrderStatusAction} className="mt-3 space-y-3">
                <input type="hidden" name="orderNumber" value={order.orderNumber} />
                <select
                  name="status"
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                >
                  {transitions.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <input
                  name="note"
                  placeholder="Note (optional)"
                  className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
                <Button type="submit" variant="primary" fullWidth>
                  Update status
                </Button>
              </form>
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
