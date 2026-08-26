import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Filter,
  FlaskConical,
  Package,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { logoutAction } from '@/lib/auth/actions';
import {
  pushInventoryToHostingerAction,
  resolveCatalogueAlertAction,
  syncInventoryFromHostingerAction,
} from '@/lib/admin/actions';
import { inventoryPushAttention, inventoryPushPending } from '@/lib/orders/inventory-push';
import { cn } from '@/lib/utils';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
import { catalogHealth } from '@/lib/commerce/health';
import { openCatalogueAlerts } from '@/lib/commerce/catalogue-sync';
import { allProducts } from '@/lib/catalog/collections';
import type { OrderStatus, PaymentStatus } from '@/lib/orders/types';
import { OrderFilters, Pagination } from '@/components/admin/order-filters';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StateBlock } from '@/components/ui/states';
import { Skeleton } from '@/components/ui/skeleton';
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
  // The reconciliation report is a full inventory_baseline/stock_reservations
  // join and has nothing to do with the current page of orders, but it used to
  // be awaited alongside them — so every pagination click paid for it. It now
  // streams in behind its own boundary and the table paints first.
  const [{ orders: list, total }, admin] = await Promise.all([
    repository.listOrders({ search: q, status, paymentStatus, limit: PAGE_SIZE, offset }),
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
          <form action={logoutAction}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </div>

      {/* Streams in behind the order table rather than delaying it. */}
      <Suspense fallback={null}>
        <CatalogHealthBanner />
      </Suspense>

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

      <Suspense fallback={<Skeleton className="mt-10 h-24 w-full rounded-lg" />}>
        <InventoryPushPanel />
      </Suspense>

      <Suspense fallback={<Skeleton className="mt-10 h-48 w-full rounded-lg" />}>
        <ReconciliationPanel />
      </Suspense>
    </div>
  );
}

/**
 * The Hostinger stock queue.
 *
 * Renders nothing when the queue is empty and nothing needs attention, which is
 * the normal state — the webhook drains after every captured payment, so a job
 * only lingers here if Hostinger was unreachable, a retry ran out, or the push
 * is switched off.
 *
 * The button is safe to press repeatedly: every job re-reads the live quantity
 * and decides again, so a second press cannot decrement twice.
 */
async function InventoryPushPanel() {
  const [pending, attention] = await Promise.all([
    inventoryPushPending().catch(() => 0),
    inventoryPushAttention().catch(() => []),
  ]);

  if (pending === 0 && attention.length === 0) return null;

  return (
    <section className="mt-10 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <RefreshCw className="h-4 w-4 shrink-0 text-accent-600" />
        Hostinger stock queue
      </h2>

      <p className="mt-2 text-sm text-muted-foreground">
        {pending > 0
          ? `${pending} sold ${pending === 1 ? 'unit batch is' : 'unit batches are'} waiting to be deducted from Hostinger.`
          : 'Nothing waiting.'}
        {attention.length > 0
          ? ` ${attention.length} need${attention.length === 1 ? 's' : ''} a human.`
          : ''}
      </p>

      {attention.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {attention.map((job) => (
            <li key={job.id} className="text-xs text-foreground">
              <span
                className={cn(
                  'mr-2 rounded-sm px-1 py-0.5 font-medium uppercase',
                  job.state === 'drift' ? 'bg-warning-soft text-warning' : 'bg-surface',
                )}
              >
                {job.state}
              </span>
              <span className="tabular">{job.variantId}</span>
              <span className="text-muted-foreground">
                {' '}
                — {job.units} unit{job.units === 1 ? '' : 's'}, order #{job.orderId}
                {job.lastError ? `: ${job.lastError}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {attention.some((job) => job.state === 'drift') ? (
        <p className="mt-3 text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">Drift</strong> means the stock in
          hPanel changed while a deduction was in flight, so the push stopped rather than guess.
          Check the variant in hPanel, then press the button — it re-reads and decides again.
        </p>
      ) : null}

      <form action={pushInventoryToHostingerAction} className="mt-3">
        <Button type="submit" variant="outline" size="sm">
          Push stock to Hostinger now
        </Button>
      </form>
    </section>
  );
}

/**
 * Warns when the live catalogue has drifted away from what the code knows.
 *
 * Renders nothing when everything matches, so it costs the admin no attention
 * on a normal day.
 */
async function CatalogHealthBanner() {
  const health = await catalogHealth();
  const stale = health.unmapped.length;
  const duplicates = health.duplicateSkus;

  // Two layers, deliberately both.
  //
  // `catalogHealth()` reads the live catalogue, so it reports a duplicate the
  // moment it appears upstream — even before anyone has run a sync. The alert
  // table records what the mirror actually *refused*, which survives page
  // loads, carries a first-seen timestamp and can be acknowledged.
  //
  // Failure to read the alerts must not take down the order console, so it
  // degrades to a visible note rather than an exception. It is never silent —
  // an unread server log is how the original drift went unnoticed for so long.
  let alerts: Awaited<ReturnType<typeof openCatalogueAlerts>> = [];
  let alertsUnavailable = false;
  try {
    alerts = await openCatalogueAlerts();
  } catch (error) {
    alertsUnavailable = true;
    console.error(`[admin] catalogue alerts unavailable: ${(error as Error).message}`);
  }

  const quarantined = alerts.filter(
    (alert) => alert.kind === 'duplicate_sku' || alert.kind === 'duplicate_slug',
  );

  if (stale === 0 && duplicates.length === 0 && quarantined.length === 0 && !alertsUnavailable) {
    return null;
  }

  return (
    <section className="mt-6 rounded-lg border border-warning/40 bg-warning-soft p-4">
      <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
        Catalogue needs attention
      </h2>

      {stale > 0 ? (
        <div className="mt-2 text-sm text-muted-foreground">
          <p>
            <strong className="font-semibold text-foreground">
              {stale} of {health.total} live product{health.total === 1 ? '' : 's'}
            </strong>{' '}
            {stale === 1 ? 'has' : 'have'} no enrichment entry, so {stale === 1 ? 'it is' : 'they are'}{' '}
            filed by title matching and show no specifications, highlights, box contents, FAQs or
            warranty — and match none of the catalogue filters.
          </p>
          <p className="mt-1.5">
            An entry is keyed by Hostinger product id, so recreating a product in hPanel gives it a
            new id and detaches it. Add the ids below to{' '}
            <code className="rounded-sm bg-card px-1 py-0.5 text-xs">
              src/lib/commerce/hostinger/enrichment.ts
            </code>
            :
          </p>
          <ul className="mt-2 space-y-1">
            {health.unmapped.map((id) => (
              <li key={id} className="tabular text-xs text-foreground">
                {id}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {duplicates.length > 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <p>
            <strong className="font-semibold text-foreground">Duplicate SKUs upstream.</strong> Each
            of these is carried by more than one product, and our order items snapshot the SKU an
            invoice is built from.
          </p>
          <ul className="mt-2 space-y-1">
            {duplicates.map((entry) => (
              <li key={entry.sku} className="tabular text-xs text-foreground">
                {entry.sku} — {entry.productIds.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {quarantined.length > 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <p>
            <strong className="font-semibold text-foreground">
              {quarantined.length} product{quarantined.length === 1 ? '' : 's'} withheld from the
              storefront.
            </strong>{' '}
            These lost a uniqueness check at the last sync and are not shown to shoppers, so a
            duplicate SKU cannot reach an order item. Nothing was deleted — fix the collision in
            hPanel and resync.
          </p>
          <ul className="mt-2 space-y-1.5">
            {quarantined.map((alert) => (
              <li
                key={`${alert.kind}:${alert.subject}`}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground"
              >
                <span className="rounded-sm bg-card px-1 py-0.5 font-medium">
                  {alert.kind === 'duplicate_sku' ? 'SKU' : 'slug'}
                </span>
                <span className="tabular">{alert.subject}</span>
                <span className="text-muted-foreground">
                  held by {String(alert.detail.heldBy ?? '—')}, withheld{' '}
                  {String(alert.detail.quarantined ?? '—')}
                </span>
                <form action={resolveCatalogueAlertAction} className="ml-auto">
                  <input type="hidden" name="kind" value={alert.kind} />
                  <input type="hidden" name="subject" value={alert.subject} />
                  <Button type="submit" variant="outline" size="sm">
                    Acknowledge
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {alertsUnavailable ? (
        <p className="mt-3 text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">
            Catalogue alerts could not be read.
          </strong>{' '}
          The mirror tables are probably missing — run{' '}
          <code className="rounded-sm bg-card px-1 py-0.5 text-xs">npm run db:migrate</code>.
          Duplicate prevention is not active until they exist.
        </p>
      ) : null}
    </section>
  );
}

/**
 * Stock sold here that still has to be applied by hand in hPanel.
 *
 * Hostinger exposes no inventory write API, so our ledger and the merchant's
 * own figures can only be brought back together manually.
 */
async function ReconciliationPanel() {
  const [reconciliation, products] = await Promise.all([
    orders().reconciliationReport(),
    allProducts(),
  ]);
  if (reconciliation.length === 0) return null;

  // A variant the merchant has since deleted upstream cannot be deducted in
  // hPanel — there is nothing left to deduct it from. Those rows would
  // otherwise sit in this list permanently, looking like outstanding work.
  const liveVariantIds = new Set(products.flatMap((p) => p.variants.map((v) => v.id)));
  const orphaned = reconciliation.filter((row) => !liveVariantIds.has(row.variantId));

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 heading-3">
        <RefreshCw className="h-4.5 w-4.5 text-accent-600" />
        Stock to reconcile in hPanel
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
        Hostinger provides no inventory write API, so these quantities must be deducted in hPanel
        by hand. Each figure is units sold here that Hostinger&rsquo;s own stock does not yet
        account for.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[38rem] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Variant</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Sold, not deducted</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Our baseline</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Should become</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Baseline synced</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {reconciliation.map((row) => (
              <tr key={row.variantId}>
                <td className="tabular px-4 py-3 text-xs">
                  {row.variantId}
                  {liveVariantIds.has(row.variantId) ? null : (
                    <span className="ml-2 whitespace-nowrap rounded-sm bg-secondary px-1.5 py-0.5 text-2xs font-semibold uppercase text-muted-foreground">
                      not in catalogue
                    </span>
                  )}
                </td>
                <td className="tabular px-4 py-3 text-right font-semibold">{row.sold}</td>
                <td className="tabular px-4 py-3 text-right text-muted-foreground">
                  {row.baseline}
                </td>
                <td className="tabular px-4 py-3 text-right font-semibold text-foreground">
                  {Math.max(0, row.baseline - row.sold)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {formatDate(row.syncedAt.toISOString())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order matters here, and getting it wrong oversells. */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4">
        <h3 className="font-display text-sm font-semibold text-foreground">
          After you have updated hPanel
        </h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            In hPanel, set each variant above to the <strong>Should become</strong> figure.
          </li>
          <li>
            Then press resync. It reads Hostinger fresh, adopts those numbers as our new
            baseline, and marks the sales above as settled so they stop being subtracted a
            second time.
          </li>
        </ol>
        <p className="mt-2 text-sm text-muted-foreground">
          Pressing this <strong>before</strong> updating hPanel would settle the sales while
          Hostinger still counts the stock as on hand, and the shop could oversell. Orders
          still awaiting payment keep their reserved units either way.
        </p>
        {orphaned.length > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {orphaned.length === 1 ? 'One row is' : `${orphaned.length} rows are`} marked{' '}
            <strong>not in catalogue</strong>: the product was deleted or recreated upstream, so
            there is nothing in hPanel left to deduct. Resyncing will not clear{' '}
            {orphaned.length === 1 ? 'it' : 'them'} — {orphaned.length === 1 ? 'it is' : 'they are'}{' '}
            a record of stock sold against a product that no longer exists.
          </p>
        ) : null}
        <form action={syncInventoryFromHostingerAction} className="mt-3">
          <Button type="submit" variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
            I have updated hPanel &mdash; resync stock
          </Button>
        </form>
      </div>
    </section>
  );
}
