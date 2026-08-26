'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import type { FacetGroup, FacetId, ProductQuery } from '@/lib/commerce/types';
import {
  activeFilterCount,
  buildQueryString,
  clearAllFilters,
  toggleFacetValue,
} from '@/lib/catalog/query';
import { FACET_DEFINITIONS } from '@/lib/catalog/facets';
import { formatAmount, formatPrice } from '@/lib/catalog/pricing';
import { CollapsibleSection } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox, Input } from '@/components/ui/field';
import { Drawer } from '@/components/ui/overlay';
import { Rating } from '@/components/ui/rating';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------- routing */

/**
 * Facet navigation, with a pending flag.
 *
 * Category and search pages are dynamic, so a facet click is a server round
 * trip. Without `useTransition` the checkbox flips and then nothing visibly
 * happens until the new grid streams in — on a slow connection the control
 * looks broken and gets clicked again.
 *
 * The feedback belongs on the control the shopper touched rather than in a
 * global progress bar, which is why the flag is returned here and applied by
 * each caller.
 */
function useFacetNavigation(basePath: string) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const navigate = React.useCallback(
    (next: ProductQuery) => {
      const qs = buildQueryString(next);
      startTransition(() => {
        // scroll:false keeps the shopper's position in the grid while refining.
        router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
      });
    },
    [basePath, router],
  );

  return { navigate, pending };
}

export function hrefFor(
  basePath: string,
  query: ProductQuery,
  overrides: Partial<ProductQuery>,
): string {
  const qs = buildQueryString(query, overrides);
  return qs ? `${basePath}?${qs}` : basePath;
}

/* ------------------------------------------------------------ facet panel */

function FacetPanel({
  facets,
  query,
  navigate,
}: {
  facets: FacetGroup[];
  query: ProductQuery;
  navigate: (next: ProductQuery) => void;
}) {
  return (
    <div>
      {facets.map((facet) => {
        const selected = query.filters[facet.id] ?? [];

        if (facet.type === 'range') {
          return (
            <PriceFacet key={facet.id} facet={facet} query={query} navigate={navigate} />
          );
        }

        if (facet.type === 'toggle') {
          const isOn = selected.includes('yes');
          return (
            <div key={facet.id} className="border-b border-border py-4 last:border-b-0">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-foreground">
                  {facet.label}
                </span>
                <Checkbox
                  checked={isOn}
                  onChange={() => navigate(toggleFacetValue(query, facet.id, 'yes'))}
                />
              </label>
            </div>
          );
        }

        const def = FACET_DEFINITIONS[facet.id];

        return (
          <CollapsibleSection
            key={facet.id}
            title={facet.label}
            defaultOpen={!def.collapsedByDefault}
            meta={
              selected.length > 0 ? (
                <span className="tabular rounded-sm bg-accent px-1.5 py-0.5 text-2xs font-bold text-accent-foreground">
                  {selected.length}
                </span>
              ) : null
            }
          >
            <ul className="space-y-0.5">
              {(facet.options ?? []).map((option) => {
                const checked = selected.includes(option.value);
                const disabled = option.count === 0 && !checked;
                return (
                  <li key={option.value}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-sm px-1 py-2 transition-colors hover:bg-secondary',
                        disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onChange={() => navigate(toggleFacetValue(query, facet.id, option.value))}
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-foreground">
                        {facet.type === 'rating' ? (
                          <>
                            <Rating value={Number(option.value)} />
                            <span className="text-muted-foreground">&amp; above</span>
                          </>
                        ) : (
                          <span className="truncate">{option.label}</span>
                        )}
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </CollapsibleSection>
        );
      })}
    </div>
  );
}

function PriceFacet({
  facet,
  query,
  navigate,
}: {
  facet: FacetGroup;
  query: ProductQuery;
  navigate: (next: ProductQuery) => void;
}) {
  const min = facet.min ?? 0;
  const max = facet.max ?? 0;

  const [from, setFrom] = React.useState(
    query.priceMin !== undefined ? String(Math.round(query.priceMin / 100)) : '',
  );
  const [to, setTo] = React.useState(
    query.priceMax !== undefined ? String(Math.round(query.priceMax / 100)) : '',
  );
  const [slider, setSlider] = React.useState(
    query.priceMax !== undefined ? Math.round(query.priceMax / 100) : Math.round(max / 100),
  );

  React.useEffect(() => {
    setFrom(query.priceMin !== undefined ? String(Math.round(query.priceMin / 100)) : '');
    setTo(query.priceMax !== undefined ? String(Math.round(query.priceMax / 100)) : '');
    setSlider(query.priceMax !== undefined ? Math.round(query.priceMax / 100) : Math.round(max / 100));
  }, [query.priceMin, query.priceMax, max]);

  const apply = (nextFrom: string, nextTo: string) => {
    const parsedFrom = nextFrom ? Number(nextFrom) * 100 : undefined;
    const parsedTo = nextTo ? Number(nextTo) * 100 : undefined;
    navigate({ ...query, priceMin: parsedFrom, priceMax: parsedTo, page: 1 });
  };

  return (
    <CollapsibleSection title={facet.label}>
      <p className="text-xs text-muted-foreground">
        Products here run from{' '}
        <span className="tabular font-medium text-foreground">{formatPrice(min)}</span> to{' '}
        <span className="tabular font-medium text-foreground">{formatPrice(max)}</span>.
      </p>

      <label className="mt-4 block">
        <span className="sr-only">Maximum price</span>
        <input
          type="range"
          min={Math.round(min / 100)}
          max={Math.round(max / 100)}
          step={500}
          value={slider}
          onChange={(e) => setSlider(Number(e.target.value))}
          onMouseUp={() => apply(from, String(slider))}
          onTouchEnd={() => apply(from, String(slider))}
          onKeyUp={(e) => {
            if (e.key === 'Enter') apply(from, String(slider));
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-[hsl(var(--accent))]"
        />
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Up to{' '}
        <span className="tabular font-semibold text-foreground">
          ₹{formatAmount(slider * 100)}
        </span>
      </p>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply(from, to);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">From</span>
          <Input
            inputMode="numeric"
            value={from}
            onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))}
            placeholder={String(Math.round(min / 100))}
            className="h-10"
            aria-label="Minimum price in rupees"
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">To</span>
          <Input
            inputMode="numeric"
            value={to}
            onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))}
            placeholder={String(Math.round(max / 100))}
            className="h-10"
            aria-label="Maximum price in rupees"
          />
        </label>
        <Button type="submit" variant="outline" size="sm" className="h-10">
          Go
        </Button>
      </form>
    </CollapsibleSection>
  );
}

/* ---------------------------------------------------------------- sidebar */

export function FacetSidebar({
  facets,
  query,
  basePath,
}: {
  facets: FacetGroup[];
  query: ProductQuery;
  basePath: string;
}) {
  const { navigate, pending } = useFacetNavigation(basePath);
  const count = activeFilterCount(query);

  return (
    <aside className="hidden lg:block" aria-label="Filters">
      <div
        aria-busy={pending}
        className={cn(
          'sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 transition-opacity',
          // Dimmed rather than disabled: a transition can be interrupted, so a
          // shopper who changes their mind mid-request should not have to wait.
          pending && 'opacity-60',
        )}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-display text-base font-bold text-foreground">Filters</h2>
          {count > 0 ? (
            <button
              type="button"
              onClick={() => navigate(clearAllFilters(query))}
              className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
            >
              Clear all
            </button>
          ) : null}
        </div>
        <FacetPanel facets={facets} query={query} navigate={navigate} />
      </div>
    </aside>
  );
}

/* ------------------------------------------------------- mobile filter UI */

export function MobileFilterButton({
  facets,
  query,
  basePath,
  total,
}: {
  facets: FacetGroup[];
  query: ProductQuery;
  basePath: string;
  total: number;
}) {
  const [open, setOpen] = React.useState(false);
  const { navigate, pending } = useFacetNavigation(basePath);
  const count = activeFilterCount(query);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="lg:hidden">
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {count > 0 ? (
          <span className="tabular ml-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-2xs font-bold text-accent-foreground">
            {count}
          </span>
        ) : null}
      </Button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        side="bottom"
        title="Filters"
        description={`${total} ${total === 1 ? 'product' : 'products'} match`}
        footer={
          <div className="flex gap-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                navigate(clearAllFilters(query));
                setOpen(false);
              }}
              disabled={count === 0}
            >
              Clear all
            </Button>
            <Button variant="accent" fullWidth onClick={() => setOpen(false)}>
              Show {total} {total === 1 ? 'product' : 'products'}
            </Button>
          </div>
        }
      >
        <div
          aria-busy={pending}
          className={cn('px-4 pb-2 transition-opacity', pending && 'opacity-60')}
        >
          <FacetPanel facets={facets} query={query} navigate={navigate} />
        </div>
      </Drawer>
    </>
  );
}

/* ---------------------------------------------------------- active chips */

export function ActiveFilterChips({
  query,
  basePath,
  facets,
}: {
  query: ProductQuery;
  basePath: string;
  facets: FacetGroup[];
}) {
  const { navigate, pending } = useFacetNavigation(basePath);
  const entries = Object.entries(query.filters) as Array<[FacetId, string[]]>;
  const hasPrice = query.priceMin !== undefined || query.priceMax !== undefined;

  if (entries.length === 0 && !hasPrice) return null;

  const labelFor = (facetId: FacetId, value: string) => {
    const group = facets.find((f) => f.id === facetId);
    const option = group?.options?.find((o) => o.value === value);
    return option?.label ?? FACET_DEFINITIONS[facetId].labelOf(value);
  };

  return (
    <div
      aria-busy={pending}
      className={cn('flex flex-wrap items-center gap-2 transition-opacity', pending && 'opacity-60')}
    >
      <span className="text-xs font-medium text-muted-foreground">Filtered by</span>

      {entries.flatMap(([facetId, values]) =>
        values.map((value) => (
          <button
            key={`${facetId}-${value}`}
            type="button"
            onClick={() => navigate(toggleFacetValue(query, facetId, value))}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-2 text-xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            {labelFor(facetId, value)}
            <X className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
            <span className="sr-only">Remove filter</span>
          </button>
        )),
      )}

      {hasPrice ? (
        <button
          type="button"
          onClick={() => navigate({ ...query, priceMin: undefined, priceMax: undefined, page: 1 })}
          className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-2 text-xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
        >
          {query.priceMin !== undefined ? formatPrice(query.priceMin) : 'Any'} –{' '}
          {query.priceMax !== undefined ? formatPrice(query.priceMax) : 'Any'}
          <X className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
          <span className="sr-only">Remove price filter</span>
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => navigate(clearAllFilters(query))}
        className="text-xs font-semibold text-accent-600 underline-offset-4 hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ sort */

export function SortSelect({
  query,
  basePath,
  options,
}: {
  query: ProductQuery;
  basePath: string;
  options: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <label className="flex items-center gap-2">
      <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">Sort</span>
      <select
        value={query.sort}
        // Disabled while re-sorting, unlike the facet panel: a native select
        // shows the newly chosen option immediately, so leaving it live would
        // let a second choice be made that the first response then overwrites.
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          const qs = buildQueryString(query, {
            sort: e.target.value as ProductQuery['sort'],
            page: 1,
          });
          startTransition(() => {
            router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
          });
        }}
        className="h-11 cursor-pointer rounded-md border border-input bg-card px-3 pr-8 text-sm font-medium text-foreground transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
        aria-label="Sort products"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
