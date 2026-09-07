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

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
          1. Start from the template
        </h2>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
          The sample already lists every SKU in the catalogue, so you can fill in the two price
          columns rather than typing identifiers. Both MRP and selling price are required on any
          row you fill in, and the selling price cannot be higher than the MRP.
        </p>
        <ButtonLink
          href="/admin/products/bulk-pricing/template"
          variant="outline"
          size="sm"
          className="mt-3"
        >
          <Download className="h-4 w-4" />
          Download sample spreadsheet
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
          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border p-3 text-sm',
              applied
                ? 'border-success/40 bg-success-soft text-foreground'
                : 'border-warning/40 bg-warning-soft text-foreground',
            )}
          >
            {applied ? (
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
                  {report.untouchedSkuCount} other SKU
                  {report.untouchedSkuCount === 1 ? ' was' : 's were'} not mentioned in the file
                  and {report.untouchedSkuCount === 1 ? 'is' : 'are'} unchanged.
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
                  <td className="tabular px-4 py-2.5">
                    MRP {formatPrice(row.mrp)} · Selling {formatPrice(row.selling)}
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
