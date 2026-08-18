import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FlaskConical, Package, RefreshCw } from 'lucide-react';
import { isAdminAuthenticated } from '@/lib/admin/session';
import { logoutAction } from '@/lib/admin/actions';
import { orders } from '@/lib/orders/postgres-repository';
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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect('/admin/login');

  const { q } = await searchParams;
  const repository = orders();
  const { orders: list, total } = await repository.listOrders({ search: q, limit: 100 });
  const reconciliation = await repository.reconciliationReport();

  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="heading-2">Orders</h1>
          <p className="tabular mt-1 text-sm text-muted-foreground">
            {total} order{total === 1 ? '' : 's'} in the local test database
          </p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      <form className="mt-6 flex max-w-md gap-2" action="/admin">
        <input
          name="q"
          defaultValue={q}
          placeholder="Order number, phone or name"
          className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {list.length === 0 ? (
        <StateBlock
          className="mt-8"
          icon={<Package className="h-6 w-6" />}
          title={q ? 'No orders match that search' : 'No orders yet'}
          description={
            q
              ? 'Try the full order number, or the mobile number on the order.'
              : 'Place a test order from the storefront and it will appear here.'
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
