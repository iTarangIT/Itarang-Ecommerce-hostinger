import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, PackageX } from 'lucide-react';
import { formatPrice } from '@/lib/catalog/pricing';
import { categoryName, subcategoryName } from '@/lib/catalog/category-names';
import { formatDate } from '@/lib/utils';
import { listOutOfStock } from '@/lib/stock/out-of-stock';
import {
  stockNotificationSettingsMeta,
  stockNotificationSettingsOf,
} from '@/lib/stock/settings';
import { setStockNotificationsAction } from '@/lib/stock/admin-actions';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { StateBlock } from '@/components/ui/states';
import { ProductStatusPill } from '@/components/admin/product-status-pill';
import { InterestedCustomers } from '@/components/admin/interested-customers';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Out of stock',
  robots: { index: false, follow: false },
};

/**
 * Everything the shop cannot currently sell, and who is waiting for it.
 *
 * The counterpart to removing stock figures from the storefront: shoppers no
 * longer see a number, and the business needs one more than before. Every
 * figure here — the real count, what it costs, how many have been sold — reads
 * the same columns the rest of the application does. Nothing on this page is a
 * second inventory source, and nothing on it writes a quantity.
 *
 * Variants with `stock IS NULL` are absent on purpose: untracked is not sold
 * out, as `0012_product_catalogue.sql` says at length, and today that is every
 * variant in the catalogue — so an empty page here is the honest answer rather
 * than a broken one.
 */
export default async function OutOfStockPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;

  const [rows, settings, meta] = await Promise.all([
    listOutOfStock(),
    stockNotificationSettingsOf(),
    stockNotificationSettingsMeta(),
  ]);

  const pendingAlerts = rows.filter((row) => row.alertPending).length;

  return (
    <div className="container py-8">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Products
      </Link>

      <div className="mt-4">
        <h1 className="heading-2">Out of stock</h1>
        <p className="tabular mt-1 text-sm text-muted-foreground">
          {rows.length} variant{rows.length === 1 ? '' : 's'} with a stock count of zero. Variants
          whose stock is not tracked are not listed.
        </p>
      </div>

      {params.saved ? (
        <p className="mt-4 rounded-lg border border-success/40 bg-success-soft p-3 text-sm font-medium text-foreground">
          Setting saved.
        </p>
      ) : null}

      {/* The master switch. One control for both kinds of mail — the internal
          alert and the customer notification — because the reason to reach for
          it is the same for both. */}
      <form
        action={setStockNotificationsAction}
        className="mt-6 rounded-lg border border-border bg-surface p-4"
      >
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox name="enabled" defaultChecked={settings.enabled} className="mt-0.5" />
          <span>
            <span className="font-display text-sm font-semibold text-foreground">
              Send stock notification emails
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Covers the internal out-of-stock alert and the customer “back in stock” message.
              With this off, transitions are still recorded and interested customers are still
              collected — no mail is sent.
            </span>
          </span>
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" size="sm">
            Save
          </Button>
          {meta ? (
            <span className="text-xs text-muted-foreground">
              Last changed {formatDate(meta.updatedAt)}
              {meta.updatedBy ? ` by ${meta.updatedBy}` : ''}.
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Never changed — off by default.</span>
          )}
        </div>
      </form>

      {pendingAlerts > 0 && settings.enabled ? (
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          {pendingAlerts} out-of-stock alert{pendingAlerts === 1 ? '' : 's'} have not been
          delivered. They are retried the next time stock changes; check SMTP configuration if
          this persists.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <StateBlock
          className="mt-8"
          icon={<PackageX className="h-6 w-6" />}
          title="Nothing is out of stock"
          description="Every variant with a tracked stock count has units available. Variants whose stock is not tracked never appear here."
        />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[62rem] border-collapse text-sm">
            <thead>
              <tr className="bg-surface text-left">
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  Product
                </th>
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  SKU
                </th>
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  Category
                </th>
                <th scope="col" className="px-4 py-3 text-right font-display font-semibold">
                  Stock
                </th>
                <th scope="col" className="px-4 py-3 text-right font-display font-semibold">
                  Sold
                </th>
                <th scope="col" className="px-4 py-3 text-right font-display font-semibold">
                  Pricing
                </th>
                <th scope="col" className="px-4 py-3 font-display font-semibold">
                  Out of stock since
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sku} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    {/* Straight into the existing editor, on the tab that holds
                        the stock field — the console already has one place to
                        change a count and this does not add a second. */}
                    <Link
                      href={`/admin/products/${encodeURIComponent(row.productKey)}?tab=pricing`}
                      className="font-medium text-foreground underline-offset-4 hover:text-accent-600 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {[row.brand, row.modelName, row.variantTitle].filter(Boolean).join(' · ') ||
                        '—'}
                    </span>
                    <span className="mt-1 inline-block">
                      <ProductStatusPill status={row.status as never} />
                    </span>

                    <InterestedCustomers
                      productKey={row.productKey}
                      notificationsEnabled={settings.enabled}
                    />
                  </td>
                  <td className="tabular px-4 py-3">{row.sku}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {categoryName(row.category)}
                    <span className="mt-0.5 block">{subcategoryName(row.subcategory)}</span>
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold text-destructive">
                    {row.stock}
                  </td>
                  <td className="tabular px-4 py-3 text-right">{row.soldQuantity}</td>
                  <td className="tabular px-4 py-3 text-right">
                    {row.selling !== null ? formatPrice(row.selling) : '—'}
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {row.mrp !== null ? `MRP ${formatPrice(row.mrp)}` : 'No MRP'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.wentOutOfStockAt ? formatDate(row.wentOutOfStockAt) : 'Not recorded'}
                    {row.waitingCount > 0 ? (
                      <span className="mt-0.5 block font-medium text-foreground">
                        {row.waitingCount} waiting
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
