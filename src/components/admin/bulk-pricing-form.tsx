'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from 'lucide-react';
import {
  importPricingAction,
  type PricingImportState,
} from '@/lib/admin/pricing-import-actions';
import { ROW_PROBLEM_NOTE } from '@/lib/admin/bulk-pricing';
import { formatPrice } from '@/lib/catalog/pricing';
import { Button, ButtonLink } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Upload form and per-row report.
 *
 * The only client component in the admin product console. Every other panel is
 * a plain `<form action={serverAction}>` with no JavaScript, and that pattern
 * does not fit here: those actions redirect with a sentence in the query
 * string, and this one has to render a table of per-row outcomes that has no
 * business being URL-encoded. `useActionState` keeps the result in the page
 * instead.
 */
export function BulkPricingForm() {
  const [state, formAction, pending] = React.useActionState<PricingImportState, FormData>(
    importPricingAction,
    {},
  );

  const report = state.report;
  const applied = state.updated !== undefined;
  /** A valid file that asked for nothing. Success, not failure — see below. */
  const noChanges =
    !applied &&
    report !== undefined &&
    report.rejected.length === 0 &&
    report.accepted.length === 0 &&
    report.unchanged.length + report.blank.length > 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          1. Download the current price list
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          The file lists every SKU in the catalogue with the MRP and selling price it carries right
          now. Change the cells you want to update and leave the rest alone. The selling price
          cannot be higher than the MRP, and both are required on every row.
        </p>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Download it again after an upload and it comes back with your new prices in it.
        </p>
        {/* `download` keeps this out of the client router. As a soft
            navigation, the router records the route handler's URL as the
            current page even though the browser only saved a file, and the
            upload's Server Action then POSTs to /template — a GET-only route —
            gets a 405, and leaves the button on "Checking…" for good. */}
        <ButtonLink
          href="/admin/products/bulk-pricing/template"
          download
          prefetch={false}
          variant="outline"
          size="sm"
          className="mt-3"
        >
          <Download className="h-4 w-4" />
          Download current price list
        </ButtonLink>
      </div>

      <form action={formAction} className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          2. Upload the filled-in file
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Only MRP and selling price are changed. Stock, availability, titles and every other
          field are left exactly as they are. If any row is wrong, nothing at all is updated.
        </p>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          Rows you did not edit are recognised as unchanged and skipped, so re-uploading the whole
          list only ever writes the prices you actually altered.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {pending ? 'Checking…' : 'Upload and apply'}
          </Button>
        </div>
      </form>

      {state.error ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {state.error}
        </p>
      ) : null}

      {report ? (
        <div className="space-y-4">
          {/* Three outcomes, and they are not two.
              "Applied", "nothing to change" and "fix these rows" are different
              things to have happened, and folding the middle one into the
              failure state would tell an administrator who uploaded an
              unedited price list that something went wrong. Nothing did — the
              file simply agreed with the catalogue. */}
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border p-3 text-sm',
              applied || noChanges
                ? 'border-success/40 bg-success-soft text-foreground'
                : 'border-warning/40 bg-warning-soft text-foreground',
            )}
          >
            {applied || noChanges ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            )}
            <span>
              {applied ? (
                <>
                  <strong className="font-semibold">
                    {state.updated} price{state.updated === 1 ? '' : 's'} updated.
                  </strong>{' '}
                  {report.unchanged.length > 0 ? (
                    <>
                      {report.unchanged.length} row
                      {report.unchanged.length === 1 ? '' : 's'} in the file already matched the
                      catalogue and {report.unchanged.length === 1 ? 'was' : 'were'} skipped.{' '}
                    </>
                  ) : null}
                  {report.untouchedSkuCount} other SKU
                  {report.untouchedSkuCount === 1 ? ' was' : 's were'} not mentioned in the file
                  and {report.untouchedSkuCount === 1 ? 'is' : 'are'} unchanged.
                </>
              ) : noChanges ? (
                <>
                  <strong className="font-semibold">Nothing to change.</strong> Every row in the
                  file either already carries the price the catalogue holds or states no price at
                  all, so nothing was written.
                </>
              ) : (
                <>
                  <strong className="font-semibold">Nothing was updated.</strong>{' '}
                  {report.rejected.length === 0
                    ? 'The file contained no rows to apply.'
                    : `${report.rejected.length} row${report.rejected.length === 1 ? '' : 's'} need${report.rejected.length === 1 ? 's' : ''} correcting. Fix ${report.rejected.length === 1 ? 'it' : 'them'} and upload the file again.`}
                </>
              )}
            </span>
          </div>

          {/* Named, not merely counted.
              A blank pair of price cells is how a product with no price yet
              comes back, and it is also what an administrator leaves behind
              when they meant to fill one in. Listing the SKUs is the difference
              between those two, and it costs one line each. */}
          {report.blank.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {report.blank.length} row{report.blank.length === 1 ? '' : 's'} stated no price and{' '}
                {report.blank.length === 1 ? 'was' : 'were'} left alone:{' '}
                <span className="tabular font-medium text-foreground">
                  {report.blank.map((row) => row.sku).join(', ')}
                </span>
                . Fill in both MRP and selling price to set one.
              </span>
            </p>
          ) : null}

          {report.rejected.length > 0 ? (
            <ReportTable title={`Rows to correct (${report.rejected.length})`}>
              {report.rejected.map((row) => (
                <tr key={row.rowNumber} className="border-t border-border">
                  <td className="tabular px-4 py-2.5">{row.rowNumber}</td>
                  <td className="px-4 py-2.5 font-medium">{row.sku || '—'}</td>
                  <td className="px-4 py-2.5 text-destructive">{ROW_PROBLEM_NOTE[row.problem]}</td>
                </tr>
              ))}
            </ReportTable>
          ) : null}

          {report.accepted.length > 0 ? (
            <ReportTable
              title={
                applied
                  ? `Updated (${report.accepted.length})`
                  : `Would have been updated (${report.accepted.length})`
              }
            >
              {report.accepted.map((row) => (
                <tr key={row.rowNumber} className="border-t border-border">
                  <td className="tabular px-4 py-2.5">{row.rowNumber}</td>
                  <td className="px-4 py-2.5 font-medium">{row.sku}</td>
                  {/* The change, not the destination. What an administrator is
                      checking after a bulk upload is whether a price moved the
                      way they meant it to. */}
                  <td className="tabular px-4 py-2.5">
                    MRP <PriceChange from={row.previousMrp} to={row.mrp} /> · Selling{' '}
                    <PriceChange from={row.previousSelling} to={row.selling} />
                  </td>
                </tr>
              ))}
            </ReportTable>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One price, before and after.
 *
 * A variant that had no price at all is written as "not set" rather than
 * "₹0.00" — the column is nullable precisely so a draft can exist before its
 * commercial terms do, and zero rupees is a different and much worse claim.
 */
function PriceChange({ from, to }: { from: number | null; to: number }) {
  return (
    <>
      <span className="text-muted-foreground">{from === null ? 'not set' : formatPrice(from)}</span>
      <span className="mx-1 text-muted-foreground">→</span>
      <span className="font-semibold text-foreground">{formatPrice(to)}</span>
    </>
  );
}

function ReportTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="bg-surface text-left">
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                Row
              </th>
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                SKU
              </th>
              <th scope="col" className="px-4 py-2.5 font-display font-semibold">
                Result
              </th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}
