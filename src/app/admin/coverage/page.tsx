import type { Metadata } from 'next';
import { Upload } from 'lucide-react';
import { importCoverageAction } from '@/lib/admin/service-actions';
import { coverageStats, searchCoverage } from '@/lib/support/serviceability-server';
import { DEFAULT_DELIVERY_DAYS } from '@/lib/support/serviceability';
import { Button } from '@/components/ui/button';
import { Notice, ServiceNav } from '@/components/admin/service-nav';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Delivery coverage',
  robots: { index: false, follow: false },
};

export default async function AdminCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; notice?: string }>;
}) {
  const search = await searchParams;
  const term = (search.q ?? '').trim().slice(0, 40);
  const [stats, rows] = await Promise.all([coverageStats(), searchCoverage(term).catch(() => [])]);

  return (
    <div className="container py-8">
      <ServiceNav
        current="/admin/coverage"
        title="Delivery coverage"
        description={`The pincodes behind the "Check delivery" box and the checkout. A listed, active pincode shows its own delivery time; a pincode marked inactive cannot be ordered to; any pincode not listed is told "usually ${DEFAULT_DELIVERY_DAYS - 2}–${DEFAULT_DELIVERY_DAYS} working days".`}
      />
      <Notice text={search.notice} />

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide">Upload a CSV</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            One pincode per line: <code className="text-foreground">pincode,city,state,delivery_days,cod,active</code>.
            The last two are optional (yes/no; COD defaults to no, active to yes). A header row is
            ignored. Uploading a pincode again updates it.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-surface p-3 text-xs">
            {'pincode,city,state,delivery_days,cod,active\n122018,Gurugram,Haryana,2,yes,yes\n110001,New Delhi,Delhi,2,no,yes'}
          </pre>
          <form action={importCoverageAction} className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="max-w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm"
            />
            <Button type="submit" size="sm">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </form>
        </section>

        <section className="lg:col-span-7">
          <p className="text-sm text-muted-foreground">
            {stats.total} pincode{stats.total === 1 ? '' : 's'} listed, {stats.active} active.
          </p>
          <form method="get" className="mt-3 flex gap-2">
            <input
              name="q"
              defaultValue={term}
              placeholder="Search by pincode or city"
              className="h-10 flex-1 rounded-md border border-input bg-card px-3 text-sm"
            />
            <Button type="submit" size="sm" variant="outline" className="h-10">
              Search
            </Button>
          </form>
          {rows.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="bg-surface text-left">
                    <th className="px-3 py-2 font-semibold">Pincode</th>
                    <th className="px-3 py-2 font-semibold">City</th>
                    <th className="px-3 py-2 font-semibold">State</th>
                    <th className="px-3 py-2 text-right font-semibold">Days</th>
                    <th className="px-3 py-2 font-semibold">COD</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.pincode} className="border-t border-border">
                      <td className="tabular px-3 py-2">{row.pincode}</td>
                      <td className="px-3 py-2">{row.city}</td>
                      <td className="px-3 py-2">{row.state}</td>
                      <td className="tabular px-3 py-2 text-right">{row.deliveryDays}</td>
                      <td className="px-3 py-2">{row.codAvailable ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{row.active ? 'Active' : 'Not delivered'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
              {stats.total === 0 ? 'No pincodes uploaded yet.' : 'No pincodes match.'}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
