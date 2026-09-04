import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PRODUCT_STATUSES } from '@/lib/products/types';

/**
 * Filters and paging for the product list.
 *
 * Deliberately a copy of the shape `order-filters.tsx` uses rather than a
 * generalisation of it: the two lists filter on different columns, and a shared
 * component parameterised over field lists would be longer than both and read
 * worse than either. A plain GET form with no client state is the whole
 * mechanism in both cases.
 */

export interface ProductFilterState {
  q?: string;
  status?: string;
  category?: string;
}

const CATEGORIES = ['inverters', 'batteries', 'ups', 'combos'] as const;

const FIELD = 'h-11 rounded-md border border-input bg-card px-3 text-sm';
const LABEL = 'text-xs font-medium text-muted-foreground';

export function ProductFilters({ current }: { current: ProductFilterState }) {
  const hasFilters = Boolean(current.q || current.status || current.category);

  return (
    <form className="mt-6 flex flex-wrap items-end gap-2" action="/admin/products">
      <div className="flex min-w-[16rem] flex-1 flex-col gap-1.5">
        <label htmlFor="q" className={LABEL}>
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={current.q}
          placeholder="Title, model number, brand or slug"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className={LABEL}>
          Status
        </label>
        <select id="status" name="status" defaultValue={current.status ?? ''} className={FIELD}>
          <option value="">Any</option>
          {PRODUCT_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value[0]?.toUpperCase()}
              {value.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className={LABEL}>
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={current.category ?? ''}
          className={FIELD}
        >
          <option value="">Any</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value[0]?.toUpperCase()}
              {value.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" variant="outline">
        Apply
      </Button>

      {hasFilters ? (
        <Link
          href="/admin/products"
          className="px-2 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Clear
        </Link>
      ) : null}
    </form>
  );
}

export function ProductPagination({
  total,
  offset,
  pageSize,
  current,
}: {
  total: number;
  offset: number;
  pageSize: number;
  current: ProductFilterState;
}) {
  if (total <= pageSize) return null;

  const page = Math.floor(offset / pageSize) + 1;
  const pages = Math.ceil(total / pageSize);

  const href = (nextOffset: number) => {
    const search = new URLSearchParams();
    if (current.q) search.set('q', current.q);
    if (current.status) search.set('status', current.status);
    if (current.category) search.set('category', current.category);
    if (nextOffset > 0) search.set('offset', String(nextOffset));
    const query = search.toString();
    return query ? `/admin/products?${query}` : '/admin/products';
  };

  const link = 'rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary';

  return (
    <nav aria-label="Pages" className="mt-5 flex items-center justify-between gap-3">
      <p className="tabular text-sm text-muted-foreground">
        Page {page} of {pages} · showing {offset + 1}–{Math.min(offset + pageSize, total)} of{' '}
        {total}
      </p>
      <div className="flex gap-2">
        {offset > 0 ? (
          <Link href={href(Math.max(0, offset - pageSize))} className={link}>
            Previous
          </Link>
        ) : null}
        {offset + pageSize < total ? (
          <Link href={href(offset + pageSize)} className={link}>
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
