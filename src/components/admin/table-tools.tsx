import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { rangeParams, type ResolvedRange } from '@/lib/admin/analytics';
import { cn } from '@/lib/utils';

/**
 * Small pieces shared by the funnel's report tables: a CSV link, a labelled
 * filter field, a pager, and the URL builder they all go through.
 *
 * Everything is a link or a plain GET form, like the rest of the admin
 * screens, so a filtered view can be bookmarked and needs no client code.
 */

/**
 * `base?range…&extra…`, dropping empty values.
 *
 * The range always goes through `rangeParams` — rebuilding it by hand is how a
 * custom range silently reverts to a preset on the next click.
 */
export function reportHref(
  base: string,
  range: ResolvedRange,
  extra: Record<string, string | number | null | undefined> = {},
): string {
  const params = rangeParams(range);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
  }
  return `${base}?${params.toString()}`;
}

/** Hidden inputs that carry the range (and anything else) through a GET form. */
export function HiddenParams({
  range,
  extra = {},
}: {
  range: ResolvedRange;
  extra?: Record<string, string | null | undefined>;
}) {
  const params = rangeParams(range);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return (
    <>
      {[...params.entries()].map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

/** A plain link, so the browser downloads the file without any client code. */
export function DownloadLink({ href, title }: { href: string; title?: string }) {
  return (
    <a
      href={href}
      download
      title={title}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-card transition-colors hover:bg-primary-600"
    >
      <Download className="h-4 w-4" />
      Download CSV
    </a>
  );
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

/**
 * Makes a whole table row clickable without client JavaScript: put this class
 * on the row's primary link and `relative` on the `<tr>`. The link's `::after`
 * stretches over the row, and any other link in the row sits above it with
 * `relative z-10`.
 */
export const ROW_LINK = 'after:absolute after:inset-0';

/** Links placed inside a clickable row, so they stay clickable themselves. */
export const IN_ROW_LINK = 'relative z-10';

/** A number that opens the rows behind it. */
export function CountLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'tabular rounded px-1 text-primary underline-offset-2 hover:text-accent-600 hover:underline',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  href,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Builds the link for a given page number. */
  href: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const button =
    'inline-flex h-9 items-center gap-1 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary';

  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="tabular text-sm text-muted-foreground">
        {first}–{last} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={button}>
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={button}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** `?page=` as a positive integer, defaulting to 1. */
export function pageNumber(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 1;
}
