import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, FlaskConical, PhoneCall } from 'lucide-react';
import { CALLBACK_WINDOW_DAYS, listCallbacks } from '@/lib/admin/callbacks';
import { markCalledAction } from '@/lib/admin/staff-order-actions';
import { allProducts } from '@/lib/catalog/collections';
import { formatPrice } from '@/lib/catalog/pricing';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/admin/service-nav';
import { StateBlock } from '@/components/ui/states';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Call-backs',
  robots: { index: false, follow: false },
};

/**
 * Admin → Call-backs: shoppers who started checkout and did not pay (R-13).
 *
 * Authorization is inherited from `admin/layout.tsx`; the "Called" action
 * repeats it. Who belongs on the list, and when they leave it, is argued in
 * `lib/admin/callbacks.ts`.
 */
export default async function CallbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; show?: string }>;
}) {
  const { notice, show } = await searchParams;
  const includeCalled = show === 'all';
  const [rows, products] = await Promise.all([listCallbacks({ includeCalled }), allProducts()]);
  // Account rows carry product ids from the funnel; the page names them.
  const titleOf = new Map(products.map((product) => [product.id, product.title]));

  return (
    <div className="container py-8">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="heading-2">Call-backs</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Started checkout in the last {CALLBACK_WINDOW_DAYS} days and did not pay. A row leaves the list
            by itself once the customer pays; tick “Called” after ringing them.
          </p>
        </div>
        <Link
          href={includeCalled ? '/admin/callbacks' : '/admin/callbacks?show=all'}
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-secondary"
        >
          {includeCalled ? 'Hide called' : 'Show called too'}
        </Link>
      </div>

      <Notice text={notice} />

      {rows.length === 0 ? (
        <StateBlock
          className="mt-8"
          icon={<PhoneCall className="h-6 w-6" />}
          title="Nobody to call"
          description="Every checkout in the window was paid, or has been called."
        />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[60rem] text-left text-sm">
            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Mobile</th>
                <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Amount</th>
                <th scope="col" className="px-4 py-3 font-semibold">Pincode</th>
                <th scope="col" className="px-4 py-3 font-semibold">When</th>
                <th scope="col" className="px-4 py-3 font-semibold">Called</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {rows.map((row) => (
                <tr key={`${row.kind}-${row.subjectId}`} className="align-top">
                  <td className="px-4 py-3">
                    {row.phone ? (
                      <a href={`tel:+91${row.phone}`} className="tabular font-semibold text-primary hover:underline">
                        {row.phone}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">No mobile on the account</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {row.name ?? '—'}
                      {row.email ? ` · ${row.email}` : ''}
                    </span>
                    {row.isTest ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-warning-soft px-1.5 py-0.5 text-2xs font-bold uppercase text-warning">
                        <FlaskConical className="h-3 w-3" />
                        Test
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {row.products.length > 0 ? (
                      <span className="block">
                        {row.products.map((product) => (row.kind === 'account' ? (titleOf.get(product) ?? product) : product)).join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not recorded</span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {row.kind === 'order' ? (
                        <>
                          <Link href={`/admin/orders/${row.orderNumber}`} className="tabular underline underline-offset-2">
                            {row.orderNumber}
                          </Link>{' '}
                          · payment {row.paymentStatus}
                        </>
                      ) : (
                        'Reached checkout, placed no order'
                      )}
                    </span>
                  </td>
                  <td className="tabular px-4 py-3 text-right font-semibold">
                    {row.amount === null ? '—' : `${row.kind === 'account' ? '≈ ' : ''}${formatPrice(row.amount)}`}
                  </td>
                  <td className="tabular px-4 py-3">{row.pincode ?? '—'}</td>
                  <td className="tabular px-4 py-3 text-xs text-muted-foreground">{formatDate(row.startedAt)}</td>
                  <td className="px-4 py-3">
                    {row.calledAt ? (
                      <span className="inline-flex items-start gap-1.5 text-xs text-success">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          {row.calledBy} · {formatDate(row.calledAt)}
                          {row.note ? <span className="block text-muted-foreground">{row.note}</span> : null}
                        </span>
                      </span>
                    ) : (
                      <form action={markCalledAction} className="flex min-w-[14rem] gap-2">
                        <input type="hidden" name="kind" value={row.kind} />
                        <input type="hidden" name="subjectId" value={row.subjectId} />
                        <input
                          name="note"
                          maxLength={500}
                          placeholder="Note (optional)"
                          aria-label="Call note"
                          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                        />
                        <Button type="submit" variant="outline" size="sm">
                          Called
                        </Button>
                      </form>
                    )}
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
