import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { RangeKey } from '@/lib/admin/analytics';

/**
 * Time-range controls for the analytics screen.
 *
 * Links rather than a form, and the range lives in the URL, for the same reason
 * the order filters work that way: a view of a particular month can be
 * bookmarked and sent to somebody else. The month selector is a plain GET form
 * so it needs no client JavaScript either.
 */

const PRESETS: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'last_6_months', label: 'Last 6 months' },
];

/** `2099-04` → `April 2099`, without constructing a Date in the server's zone. */
export function monthLabel(month: string): string {
  const [year, index] = month.split('-');
  const names = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${names[Number(index) - 1] ?? month} ${year}`;
}

export function RangeFilter({
  current,
  currentMonth,
  months,
  basePath = '/admin/analytics',
  carry,
}: {
  current: RangeKey;
  currentMonth: string | null;
  months: string[];
  /** Which screen the controls navigate within. Analytics and funnel share them. */
  basePath?: string;
  /**
   * Other query parameters this screen owns, preserved across a range change.
   *
   * Without it, choosing a month would silently reset the funnel's segment back
   * to everyone — the range and the segment are independent choices and neither
   * should quietly undo the other.
   */
  carry?: Record<string, string>;
}) {
  const extra = Object.entries(carry ?? {});
  const suffix = extra.map(([key, value]) => `&${key}=${encodeURIComponent(value)}`).join('');

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const active = current === preset.key;
          return (
            <Link
              key={preset.key}
              href={`${basePath}?range=${preset.key}${suffix}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-secondary',
              )}
            >
              {preset.label}
            </Link>
          );
        })}
      </div>

      {months.length > 0 ? (
        <form action={basePath} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="range" value="month" />
          {extra.map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="month" className="text-xs font-medium text-muted-foreground">
              Or pick a month
            </label>
            <select
              id="month"
              name="month"
              defaultValue={currentMonth ?? months[0]}
              className="h-11 rounded-md border border-input bg-card px-3 text-sm"
            >
              {months.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="h-11 rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Show
          </button>
        </form>
      ) : null}
    </div>
  );
}
