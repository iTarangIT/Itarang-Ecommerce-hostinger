import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, Filter, FlaskConical, LifeBuoy, Package, PhoneCall, Plus, ScrollText, TicketPercent, Truck, UserRound } from 'lucide-react';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
import { canInvoice, ordersWithoutInvoice } from '@/lib/orders/invoices';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';
import { OrderFilters, Pagination } from '@/components/admin/order-filters';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { StateBlock } from '@/components/ui/states';
import { StatusPill } from '@/components/admin/status-pill';
import { AdminProfileMenu } from '@/components/admin/admin-profile-menu';
import { OrderQuickActions } from '@/components/admin/order-quick-actions';
import { Notice } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Orders',
  robots: { index: false, follow: false },
};

/** Rows per page. Small enough to scan, large enough to avoid constant paging. */
const PAGE_SIZE = 25;

/** Only values the enum actually allows reach the query. */
function asOrderStatus(value: string | undefined): OrderStatus | undefined {
  const allowed: OrderStatus[] = [
    'pending_payment',
    'confirmed',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
  ];
  return allowed.find((s) => s === value);
}

function asPaymentStatus(value: string | undefined): PaymentStatus | undefined {
  const allowed: PaymentStatus[] = ['pending', 'authorized', 'paid', 'failed', 'refunded'];
  return allowed.find((s) => s === value);
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    payment?: string;
    offset?: string;
    notice?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const status = asOrderStatus(params.status);
  const paymentStatus = asPaymentStatus(params.payment);

  // Clamped, not trusted: a hand-edited offset must not become an unbounded
  // scan or a negative OFFSET.
  const parsedOffset = Number.parseInt(params.offset ?? '0', 10);
  const offset = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const repository = orders();
  const [{ orders: list, total }, admin] = await Promise.all([
    repository.listOrders({ search: q, status, paymentStatus, limit: PAGE_SIZE, offset }),
    currentUser(),
  ]);

  const filtered = Boolean(q || status || paymentStatus);

  // R-08: a real, invoiceable order with no invoice yet gets a badge.
  const awaitingInvoice = await ordersWithoutInvoice(
    list.filter((order) => !order.isTest && canInvoice(order)).map((order) => order.id),
  );

  // What the Action button sends back, so a status change lands on this view.
  const listQuery = new URLSearchParams();
  if (q) listQuery.set('q', q);
  if (params.status) listQuery.set('status', params.status);
  if (params.payment) listQuery.set('payment', params.payment);
  if (offset > 0) listQuery.set('offset', String(offset));

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading-2">Orders</h1>
          <p className="tabular mt-1 text-sm text-muted-foreground">
            {total} order{total === 1 ? '' : 's'}
            {filtered ? ' matching these filters' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/orders/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New order
          </Link>
          <Link
            href="/admin/callbacks"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <PhoneCall className="h-4 w-4" />
            Call-backs
          </Link>
          <Link
            href="/track"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Truck className="h-4 w-4" />
            Tracking
          </Link>
          <Link
            href="/admin/products"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Package className="h-4 w-4" />
            Products
          </Link>
          <Link
            href="/admin/campaigns"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <TicketPercent className="h-4 w-4" />
            Campaigns
          </Link>
          <Link
            href="/admin/customers"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <UserRound className="h-4 w-4" />
            Customers
          </Link>
          <Link
            href="/admin/funnel"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Filter className="h-4 w-4" />
            Funnel
          </Link>
          <Link
            href="/admin/analytics"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
          <Link
            href="/admin/support"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <LifeBuoy className="h-4 w-4" />
            Service
          </Link>
          <Link
            href="/admin/logs"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <ScrollText className="h-4 w-4" />
            Logs
          </Link>
          <AdminProfileMenu name={admin?.fullName ?? null} />
        </div>
      </div>

      <Notice text={params.notice} />

      <OrderFilters current={{ q, status: params.status, payment: params.payment }} />

      {list.length === 0 ? (
        <StateBlock
          className="mt-8"
          icon={<Package className="h-6 w-6" />}
          title={filtered ? 'No orders match these filters' : 'No orders yet'}
          description={
            filtered
              ? 'Try the full order number, the mobile number on the order, or clear the filters.'
              : 'Place an order from the storefront and it will appear here.'
          }
        />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[58rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                <th scope="col" className="px-4 py-3 font-semibold">Placed</th>
                <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {list.map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="tabular font-semibold text-primary hover:text-accent-600 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    {order.isTest ? (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-sm bg-warning-soft px-1.5 py-0.5 text-2xs font-bold uppercase text-warning">
                        <FlaskConical className="h-3 w-3" />
                        Test
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3">
                    {order.contact.name}
                    <span className="tabular block text-xs text-muted-foreground">
                      {order.contact.phone}
                    </span>
                    {order.userId ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-2xs text-muted-foreground">
                        <UserRound className="h-3 w-3" />
                        Account #{order.userId}
                      </span>
                    ) : (
                      // Placed before checkout required an account. Reachable
                      // only by order number + phone, and never auto-claimed.
                      <span className="mt-0.5 inline-flex items-center gap-1 text-2xs text-muted-foreground">
                        Guest order
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="capitalize">{order.paymentMethod}</span>
                    <StatusPill kind="payment" value={order.paymentStatus} className="ml-2" />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill kind="order" value={order.status} />
                    {awaitingInvoice.has(order.id) ? (
                      <span className="ml-2 rounded-sm bg-warning-soft px-1.5 py-0.5 text-2xs font-bold uppercase text-warning">
                        Invoice pending
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold">
                    {formatPrice(order.amounts.total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <OrderQuickActions
                      orderNumber={order.orderNumber}
                      customer={order.contact.name}
                      status={order.status}
                      shipment={order.shipment}
                      listQuery={listQuery.toString()}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        params={{ q, status: params.status, payment: params.payment }}
      />
    </div>
  );
}
