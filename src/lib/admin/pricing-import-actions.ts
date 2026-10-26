'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { invalidateCatalogSnapshot } from '@/lib/commerce';
import { CATALOG_TAG } from '@/lib/commerce/db/db-provider';
import { productRepository } from '@/lib/products/postgres-repository';
import { orders } from '@/lib/orders/postgres-repository';
import { dispatchStockAlertsInBackground } from '@/lib/stock/alerts';
import { buildPricingImportReport, type PricingImportReport } from './bulk-pricing';
import { displayValue, logAdminEvent, type FieldChange } from './audit';
import {
  MAX_WORKBOOK_BYTES,
  WorkbookError,
  readPricingWorkbook,
} from './pricing-workbook';

/**
 * The bulk price upload, as a Server Action.
 *
 * Follows the conventions in `product-actions.ts`: authorization is re-checked
 * here because a Server Action is its own POST endpoint and the admin layout's
 * guard does not protect it, and failures come back on the URL because these
 * are plain server-rendered forms with nowhere to return an error object to.
 *
 * The one difference is the result. Every other product action either saves or
 * redirects with a sentence; this one has to report per-row outcomes, which do
 * not fit in a query string. The report is therefore returned to the page,
 * which means this action is called through `useActionState` rather than a bare
 * `<form action>`.
 */

const BASE = '/admin/products/bulk-pricing';

async function requireAdminActor(): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect(`/login?next=${encodeURIComponent(BASE)}`);
  return user.email;
}

export interface PricingImportState {
  /** Whole-file failure — an unreadable workbook, a missing column. */
  error?: string;
  /** Per-row outcomes, present once the file parsed. */
  report?: PricingImportReport;
  /** Set when the rows were actually written. */
  updated?: number;
}

export async function importPricingAction(
  _previous: PricingImportState,
  formData: FormData,
): Promise<PricingImportState> {
  const actor = await requireAdminActor();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a spreadsheet to upload.' };
  }
  if (file.size > MAX_WORKBOOK_BYTES) {
    return {
      error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_WORKBOOK_BYTES / 1024 / 1024} MB.`,
    };
  }

  let rows;
  try {
    rows = await readPricingWorkbook(await file.arrayBuffer());
  } catch (error) {
    if (error instanceof WorkbookError) return { error: error.message };
    throw error;
  }

  const repository = productRepository();
  // Prices as well as SKUs: the same read validates the file and decides which
  // of its rows actually differ from what is stored. A template downloaded from
  // this console arrives carrying every current price, so without the
  // comparison a two-product change would rewrite the whole catalogue.
  const catalogue = await repository.listVariantPrices();
  const report = buildPricingImportReport(rows, catalogue);

  // Nothing is written while any row is wrong. The report still goes back so
  // the administrator can see exactly which rows to correct — a file that is
  // 39 rows right and one row wrong should not have to be diagnosed by trial.
  //
  // `applicable` is also false for a file that is entirely valid and entirely
  // unchanged. That is not a failure, and the form says so from `report`
  // rather than being told here.
  if (!report.applicable) return { report };

  const result = await repository.updateVariantPricesBySku(report.accepted, actor);

  if (!result.ok) {
    return {
      report,
      error: `SKU ${result.sku} was removed from the catalogue while the file was being checked. Nothing was updated; upload again.`,
    };
  }

  await logAdminEvent({
    entityType: 'pricing_import',
    entityId: null,
    label: file.name,
    action: 'Imported price sheet',
    actor,
    summary: `${result.updated} variant${result.updated === 1 ? '' : 's'} updated`,
    changes: importChanges(report.accepted, catalogue),
  });

  // Stock typed into the sheet is the new count on the shelf: send the
  // out-of-stock alerts and make checkout agree, as the product page does.
  const stockRows = report.accepted.filter((row) => row.stock !== undefined);
  if (stockRows.length > 0) {
    dispatchStockAlertsInBackground();
    const bySku = new Map(catalogue.map((entry) => [entry.sku, entry]));
    try {
      await orders().reconcileInventory(
        stockRows.flatMap((row) => {
          const entry = bySku.get(row.sku);
          return entry?.productKey && entry.variantKey
            ? [{ variantId: `${entry.productKey}:${entry.variantKey}`, quantity: row.stock! }]
            : [];
        }),
      );
    } catch (error) {
      console.error('[admin] checkout stock not synced after bulk import:', error);
    }
  }

  // Same invalidation the single-product pricing form performs, for the same
  // reason: without the tag purge an edited price reaches the category grid and
  // never reaches the statically rendered product page.
  invalidateCatalogSnapshot();
  revalidateTag(CATALOG_TAG);
  revalidatePath('/admin/products');
  revalidatePath(BASE);

  return { report, updated: result.updated };
}

const rupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? '—' : `₹${(paise / 100).toLocaleString('en-IN')}`;

/** What each accepted row changed, old → new, for Logs → Product log. */
function importChanges(
  accepted: PricingImportReport['accepted'],
  catalogue: Awaited<ReturnType<ReturnType<typeof productRepository>['listVariantPrices']>>,
): FieldChange[] {
  const bySku = new Map(catalogue.map((entry) => [entry.sku, entry]));
  const changes: FieldChange[] = [];
  for (const row of accepted) {
    const was = bySku.get(row.sku);
    const pairs: Array<[string, string, string | null]> = [
      ['MRP', rupees(was?.mrp), rupees(row.mrp)],
      ['Selling price', rupees(was?.selling), rupees(row.selling)],
      ['Cost price', rupees(was?.costPrice), row.costPrice === undefined ? null : rupees(row.costPrice)],
      ['Stock', displayValue(was?.stock), row.stock === undefined ? null : displayValue(row.stock)],
      [
        'Availability',
        displayValue(was?.availability),
        row.availability === undefined ? null : displayValue(row.availability),
      ],
    ];
    for (const [label, from, to] of pairs) {
      if (to !== null && from !== to) changes.push({ field: `${row.sku} · ${label}`, from, to });
    }
  }
  return changes;
}
