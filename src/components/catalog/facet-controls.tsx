'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import type { FacetGroup, FacetId, FacetRange, ProductQuery } from '@/lib/commerce/types';
import {
  activeFilterCount,
  buildQueryString,
  clearAllFilters,
  setFacetRange,
  toggleFacetValue,
} from '@/lib/catalog/query';
import { FACET_DEFINITIONS } from '@/lib/catalog/facets';
import { formatPrice } from '@/lib/catalog/pricing';
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
            <RangeFacet key={facet.id} facet={facet} query={query} navigate={navigate} />
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

/**
 * One range facet: a slider for the ceiling, plus a From/To pair.
 *
 * This was `PriceFacet`, and price was hardcoded into every line of it — the
 * rupee formatting, the ÷100 paise conversion, the digits-only input mask, the
 * step of 500. Capacity and voltage need exactly the same control, so the
 * price-specific parts became `RANGE_FACET_UI` and the rest is shared.
 *
 * Two behaviours are worth keeping in mind. The slider sets the **maximum**
 * only, as it always has: a single-thumb input cannot express both ends, and
 * the From/To fields are there for a floor. And a decimal is accepted, because
 * voltage has one — the old input stripped every non-digit, which would have
 * turned a typed "60.8" into "608".
 */
const RANGE_FACET_UI: Partial<
  Record<
    FacetId,
    {
      /** URL/display unit per stored unit. Price is stored in paise. */
      scale: number;
      step: number;
      decimals: number;
      format: (displayValue: number) => string;
      fromLabel: string;
      toLabel: string;
    }
  >
> = {
  price: {
    scale: 100,
    step: 500,
    decimals: 0,
    format: (v) => formatPrice(v * 100),
    fromLabel: 'Minimum price in rupees',
    toLabel: 'Maximum price in rupees',
  },
  batteryAh: {
    scale: 1,
    step: 1,
    decimals: 0,
    format: (v) => `${v} Ah`,
    fromLabel: 'Minimum capacity in ampere-hours',
    toLabel: 'Maximum capacity in ampere-hours',
  },
  voltage: {
    scale: 1,
    // A tenth of a volt, because the catalogue holds 12.8, 25.6, 60.8 and 73.6.
    // A step of 1 would make the top of the slider 73, which excludes the pack
    // that set the maximum — the shopper drags to the end and loses a product.
    step: 0.1,
    decimals: 1,
    format: (v) => `${v} V`,
    fromLabel: 'Minimum voltage',
    toLabel: 'Maximum voltage',
  },
};

const DEFAULT_RANGE_UI = {
  scale: 1,
  step: 1,
  decimals: 0,
  format: (v: number) => String(v),
  fromLabel: 'Minimum',
  toLabel: 'Maximum',
};

/** Trim to the facet's decimals, so the URL does not pick up float noise. */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function RangeFacet({
  facet,
  query,
  navigate,
}: {
  facet: FacetGroup;
  query: ProductQuery;
  navigate: (next: ProductQuery) => void;
}) {
  const ui = RANGE_FACET_UI[facet.id] ?? DEFAULT_RANGE_UI;
  const min = round((facet.min ?? 0) / ui.scale, ui.decimals);
  const max = round((facet.max ?? 0) / ui.scale, ui.decimals);

  const selected = query.ranges[facet.id];
  const selectedFrom = selected?.min !== undefined ? round(selected.min / ui.scale, ui.decimals) : undefined;
  const selectedTo = selected?.max !== undefined ? round(selected.max / ui.scale, ui.decimals) : undefined;

  const [from, setFrom] = React.useState(selectedFrom !== undefined ? String(selectedFrom) : '');
  const [to, setTo] = React.useState(selectedTo !== undefined ? String(selectedTo) : '');
  const [slider, setSlider] = React.useState(selectedTo ?? max);

  React.useEffect(() => {
    setFrom(selectedFrom !== undefined ? String(selectedFrom) : '');
    setTo(selectedTo !== undefined ? String(selectedTo) : '');
    setSlider(selectedTo ?? max);
  }, [selectedFrom, selectedTo, max]);

  const apply = (nextFrom: string, nextTo: string) => {
    const parsedFrom = nextFrom.trim() === '' ? undefined : Number(nextFrom) * ui.scale;
    const parsedTo = nextTo.trim() === '' ? undefined : Number(nextTo) * ui.scale;
    navigate(
      setFacetRange(
        query,
        facet.id,
        Number.isFinite(parsedFrom as number) ? parsedFrom : undefined,
        Number.isFinite(parsedTo as number) ? parsedTo : undefined,
      ),
    );
  };

  // Digits, one decimal point, nothing else. Empty stays empty so the field can
  // be cleared back to "no bound", which is not the same as its minimum.
  const sanitise = (raw: string) =>
    ui.decimals > 0 ? raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1') : raw.replace(/\D/g, '');

  return (
    <CollapsibleSection title={facet.label}>
      <p className="text-xs text-muted-foreground">
        Products here run from{' '}
        <span className="tabular font-medium text-foreground">{ui.format(min)}</span> to{' '}
        <span className="tabular font-medium text-foreground">{ui.format(max)}</span>.
      </p>

      <label className="mt-4 block">
        <span className="sr-only">{ui.toLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={ui.step}
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
        Up to <span className="tabular font-semibold text-foreground">{ui.format(slider)}</span>
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
            inputMode="decimal"
            value={from}
            onChange={(e) => setFrom(sanitise(e.target.value))}
            placeholder={String(min)}
            className="h-10"
            aria-label={ui.fromLabel}
          />
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs text-muted-foreground">To</span>
          <Input
            inputMode="decimal"
            value={to}
            onChange={(e) => setTo(sanitise(e.target.value))}
            placeholder={String(max)}
            className="h-10"
            aria-label={ui.toLabel}
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
            <Button
              variant="accent"
              fullWidth
              className="whitespace-nowrap px-3"
              onClick={() => setOpen(false)}
            >
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

  // Every narrowed range gets a chip, not just price. A shopper who filtered by
  // voltage and then scrolled past the sidebar previously had no indication the
  // filter was on and no way to drop it without finding the control again.
  const rangeEntries = (Object.entries(query.ranges) as Array<[FacetId, FacetRange]>).filter(
    ([, range]) => range && (range.min !== undefined || range.max !== undefined),
  );

  if (entries.length === 0 && rangeEntries.length === 0) return null;

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

      {rangeEntries.map(([facetId, range]) => {
        const def = FACET_DEFINITIONS[facetId];
        const ui = RANGE_FACET_UI[facetId] ?? DEFAULT_RANGE_UI;
        const show = (value: number | undefined) =>
          value === undefined ? 'Any' : ui.format(round(value / ui.scale, ui.decimals));

        return (
          <button
            key={facetId}
            type="button"
            onClick={() => navigate(setFacetRange(query, facetId, undefined, undefined))}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-2 text-xs font-medium text-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            {def.label}: {show(range.min)} – {show(range.max)}
            <X className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
            <span className="sr-only">Remove {def.label.toLowerCase()} filter</span>
          </button>
        );
      })}

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
