import Link from 'next/link';
import { Search } from 'lucide-react';
import type { ResolvedRange } from '@/lib/admin/analytics';
import { visitorLabel, type CohortFilters, type CohortRow } from '@/lib/admin/funnel-detail';
import {
  FilterField,
  HiddenParams,
  IN_ROW_LINK,
  ROW_LINK,
  reportHref,
} from '@/components/admin/table-tools';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The anonymous-visitor table and its filters, shared by the visitors list and
 * the anonymous → registered drill-downs, which show the same rows.
 */

const IST_DATETIME = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

export function CohortFilterForm({
  action,
  range,
  filters,
  filtered,
}: {
  action: string;
  range: ResolvedRange;
  filters: CohortFilters;
  filtered: boolean;
}) {
  const yesNo = (name: string, label: string, value: string | undefined) => (
    <FilterField label={label}>
      <Select name={name} defaultValue={value ?? ''} className="h-9 w-28">
        <option value="">Any</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>
    </FilterField>
  );

  return (
    <form
      action={action}
      className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3"
    >
      <HiddenParams range={range} />
      <FilterField label="Search">
        <Input
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Visitor id, email or order"
          aria-label="Search visitors"
          className="h-9 w-60"
        />
      </FilterField>
      {yesNo('wall', 'Login wall', filters.wall)}
      {yesNo('registered', 'Registered', filters.registered)}
      {yesNo('purchased', 'Paid order', filters.purchased)}
      <FilterField label="Sort">
        <Select name="sort" defaultValue={filters.sort ?? ''} className="h-9 w-40">
          <option value="">Furthest first</option>
          <option value="recent">Last seen</option>
          <option value="views">Most views</option>
        </Select>
      </FilterField>
      <Button type="submit" variant="outline" size="sm" className="h-9">
        <Search className="h-4 w-4" />
        Apply
      </Button>
      {filtered ? (
        <Link
          href={reportHref(action, range)}
          className="inline-flex h-9 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}

export function CohortTable({
  rows,
}: {
  rows: CohortRow[];
}) {
  const flag = (on: boolean, text: string, tone: string) =>
    on ? <span className={cn('font-medium', tone)}>{text}</span> : <span className="text-muted-foreground">—</span>;

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">Visitor</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Sessions</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Views</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">Cart adds</th>
            <th scope="col" className="px-4 py-3 font-semibold">Login wall</th>
            <th scope="col" className="px-4 py-3 font-semibold">Registered as</th>
            <th scope="col" className="px-4 py-3 font-semibold">Paid orders</th>
            <th scope="col" className="px-4 py-3 font-semibold">Last seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((row) => (
            <tr key={row.visitorId} className="relative transition-colors hover:bg-surface">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/funnel/visitors/${row.visitorId}`}
                  className={cn('font-semibold text-primary hover:text-accent-600 hover:underline', ROW_LINK)}
                >
                  {visitorLabel(row.visitorId)}
                </Link>
              </td>
              <td className="tabular px-4 py-3 text-right">{row.sessions}</td>
              <td className="tabular px-4 py-3 text-right">{row.views}</td>
              <td className="tabular px-4 py-3 text-right">{row.cartAdds}</td>
              <td className="px-4 py-3 text-xs">{flag(row.reachedWall, 'Reached', 'text-warning')}</td>
              <td className="px-4 py-3 text-xs">
                {row.userId ? (
                  <Link
                    href={`/admin/customers/${row.userId}`}
                    className={cn('font-medium text-success hover:underline', IN_ROW_LINK)}
                  >
                    {row.fullName || row.email}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                {row.paidOrders.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  row.paidOrders.map((order) => (
                    <Link
                      key={order}
                      href={`/admin/orders/${order}`}
                      className={cn('mr-2 font-medium text-primary hover:underline', IN_ROW_LINK)}
                    >
                      {order}
                    </Link>
                  ))
                )}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {IST_DATETIME.format(new Date(row.lastAt))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
