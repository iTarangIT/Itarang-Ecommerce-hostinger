'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Check, GitCompare, Minus, ShoppingCart, X } from 'lucide-react';
import type { CompareEntry } from '@/app/api/compare/route';
import type { ProductSummary } from '@/lib/commerce/summary';
import { formatPrice } from '@/lib/catalog/pricing';
import { useCompare } from '@/lib/store/hooks';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { RatingSummaryInline } from '@/components/ui/rating';
import { StateBlock } from '@/components/ui/states';
import { ProductRail } from '@/components/merch/product-rail';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Side-by-side comparison.
 *
 * Rows are the union of every spec label across the selected products, so
 * comparing an inverter against a combo still lines up sensibly — a product
 * that lacks a given spec shows an explicit dash rather than a blank.
 */
export function CompareBody({ suggestions }: { suggestions: ProductSummary[] }) {
  const compare = useCompare();
  const [entries, setEntries] = React.useState<CompareEntry[] | null>(null);

  const ids = compare.ids.join(',');

  React.useEffect(() => {
    if (!ids) {
      setEntries([]);
      return;
    }
    setEntries(null);
    const controller = new AbortController();
    fetch(`/api/compare?ids=${ids}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: { entries: CompareEntry[] }) => setEntries(data.entries))
      .catch(() => setEntries([]));
    return () => controller.abort();
  }, [ids]);

  const specLabels = React.useMemo(() => {
    if (!entries) return [];
    const labels: string[] = [];
    for (const entry of entries) {
      for (const label of Object.keys(entry.specs)) {
        if (!labels.includes(label)) labels.push(label);
      }
    }
    return labels;
  }, [entries]);

  return (
    <div className="container py-6 lg:py-10">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Compare' }]} />

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="heading-1">Compare products</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Up to {compare.max} products, side by side. Add products from any listing or product
            page.
          </p>
        </div>
        {compare.ids.length > 0 ? (
          <Button variant="outline" onClick={compare.clear}>
            <X className="h-4 w-4" />
            Clear all
          </Button>
        ) : null}
      </div>

      <div className="mt-8">
        {entries === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {compare.ids.map((id) => (
              <Skeleton key={id} className="h-80 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="space-y-10">
            <StateBlock
              icon={<GitCompare className="h-6 w-6" />}
              title="Nothing selected to compare yet"
              description="Tap the compare icon on any product card, or the Compare button on a product page, to build a side-by-side table of capacity, technology, warranty and price."
              actions={
                <>
                  <ButtonLink href="/c/inverters" variant="primary">
                    Browse inverters
                  </ButtonLink>
                  <ButtonLink href="/c/batteries" variant="outline">
                    Browse batteries
                  </ButtonLink>
                </>
              }
            />
            <ProductRail
              products={suggestions}
              eyebrow="Popular choices"
              title="Start with these"
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Product comparison</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 w-40 bg-background p-3 text-left align-bottom"
                  >
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      Comparing {entries.length}
                    </span>
                  </th>
                  {entries.map((entry) => (
                    <th key={entry.id} scope="col" className="w-64 p-3 align-bottom">
                      <div className="relative flex h-full flex-col rounded-lg border border-border bg-card p-3 text-left">
                        <button
                          type="button"
                          onClick={() => compare.toggle(entry.id)}
                          aria-label={`Remove ${entry.title} from comparison`}
                          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/p/${entry.slug}`}
                          className="relative mx-auto block aspect-square w-28 overflow-hidden rounded-md bg-surface"
                        >
                          <Image
                            src={entry.image}
                            alt=""
                            fill
                            sizes="112px"
                            className="object-contain p-2"
                          />
                        </Link>
                        <p className="mt-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {entry.categoryLabel}
                        </p>
                        <Link
                          href={`/p/${entry.slug}`}
                          className="mt-0.5 line-clamp-2 font-display text-sm font-semibold text-foreground hover:text-accent-600"
                        >
                          {entry.title}
                        </Link>
                        <ButtonLink
                          href={`/p/${entry.slug}`}
                          variant="primary"
                          size="sm"
                          fullWidth
                          className="mt-3"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          View product
                        </ButtonLink>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                <CompareRow label="Price" entries={entries} highlight>
                  {(entry) => (
                    <span className="flex flex-col">
                      <span className="tabular font-display text-base font-bold text-foreground">
                        {formatPrice(entry.price)}
                      </span>
                      {entry.mrp > entry.price ? (
                        <span className="tabular text-xs text-muted-foreground line-through">
                          {formatPrice(entry.mrp)} · {entry.discount}% off
                        </span>
                      ) : null}
                    </span>
                  )}
                </CompareRow>

                <CompareRow label="Customer rating" entries={entries}>
                  {(entry) =>
                    entry.rating ? (
                      <RatingSummaryInline
                        average={entry.rating.average}
                        count={entry.rating.count}
                      />
                    ) : (
                      <span className="text-muted-foreground">No reviews yet</span>
                    )
                  }
                </CompareRow>

                <CompareRow label="Availability" entries={entries}>
                  {(entry) => (
                    <span
                      className={cn(
                        'font-medium',
                        entry.availability === 'out-of-stock'
                          ? 'text-muted-foreground'
                          : entry.availability === 'low-stock'
                            ? 'text-warning'
                            : 'text-success',
                      )}
                    >
                      {entry.availability === 'out-of-stock'
                        ? 'Out of stock'
                        : entry.availability === 'low-stock'
                          ? 'Few left'
                          : 'In stock'}
                    </span>
                  )}
                </CompareRow>

                <CompareRow label="Warranty" entries={entries}>
                  {(entry) =>
                    entry.warrantyMonths === undefined ? (
                      <span className="text-muted-foreground">Not stated</span>
                    ) : (
                      <span className="tabular font-medium text-foreground">
                        {Math.round(entry.warrantyMonths / 12)} years
                      </span>
                    )
                  }
                </CompareRow>

                <CompareRow label="Installation included" entries={entries}>
                  {(entry) =>
                    entry.installationIncluded ? (
                      <Check className="h-4.5 w-4.5 text-success" aria-label="Yes" />
                    ) : (
                      <Minus className="h-4.5 w-4.5 text-muted-foreground" aria-label="No" />
                    )
                  }
                </CompareRow>

                {specLabels.map((label) => (
                  <CompareRow key={label} label={label} entries={entries}>
                    {(entry) =>
                      entry.specs[label] ? (
                        <span className="text-foreground">{entry.specs[label]}</span>
                      ) : (
                        <span className="text-muted-foreground" aria-label="Not applicable">
                          —
                        </span>
                      )
                    }
                  </CompareRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareRow({
  label,
  entries,
  children,
  highlight,
}: {
  label: string;
  entries: CompareEntry[];
  children: (entry: CompareEntry) => React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <tr className={highlight ? 'bg-surface' : undefined}>
      <th
        scope="row"
        className={cn(
          'sticky left-0 z-10 border-b border-border p-3 text-left align-top text-xs font-semibold uppercase tracking-wide text-muted-foreground',
          highlight ? 'bg-surface' : 'bg-background',
        )}
      >
        {label}
      </th>
      {entries.map((entry) => (
        <td key={entry.id} className="border-b border-border p-3 align-top">
          {children(entry)}
        </td>
      ))}
    </tr>
  );
}
