import type { Metadata } from 'next';
import Link from 'next/link';
import { FlaskConical, Package, RefreshCw, UserRound } from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';
import { OrderFilters, Pagination } from '@/components/admin/order-filters';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { StatusPill } from '@/components/admin/status-pill';

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
  searchParams: Promise<{ q?: string; status?: string; payment?: string; offset?: string }>;
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
  const [{ orders: list, total }, reconciliation, admin] = await Promise.all([
    repository.listOrders({ search: q, status, paymentStatus, limit: PAGE_SIZE, offset }),
    repository.reconciliationReport(),
    currentUser(),
  ]);

  const filtered = Boolean(q || status || paymentStatus);

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
        <div className="flex items-center gap-3">
          {admin ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">{admin.email}</span>
          ) : null}
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>

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
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Order</th>
                <th scope="col" className="px-4 py-3 font-semibold">Placed</th>
                <th scope="col" className="px-4 py-3 font-semibold">Customer</th>
                <th scope="col" className="px-4 py-3 font-semibold">Payment</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Total</th>
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
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold">
                    {formatPrice(order.amounts.total)}
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

      {/* Reconciliation — Hostinger has no inventory write API, so stock sold
          here has to be applied by hand in hPanel. */}
      {reconciliation.length > 0 ? (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 heading-3">
            <RefreshCw className="h-4.5 w-4.5 text-accent-600" />
            Stock to reconcile in hPanel
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Hostinger provides no inventory write API, so these quantities must be deducted
            manually. The figures are units sold against the baseline last synced from Hostinger.
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Variant</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Sold</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Baseline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {reconciliation.map((row) => (
                  <tr key={row.variantId}>
                    <td className="tabular px-4 py-3 text-xs">{row.variantId}</td>
                    <td className="tabular px-4 py-3 text-right font-semibold">{row.sold}</td>
                    <td className="tabular px-4 py-3 text-right text-muted-foreground">
                      {row.baseline}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
