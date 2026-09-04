import type { CategorySlug, FacetId, ProductQuery, SortId } from '@/lib/commerce/types';
import { DEFAULT_SORT, isSortId } from './sort';

export const PER_PAGE = 12;

/** Facets that appear in the URL as repeatable multi-select params. */
export const URL_FACET_IDS: FacetId[] = [
  'category',
  'subcategory',
  'capacityVa',
  'batteryAh',
  'voltage',
  'technology',
  'backupHours',
  'warrantyMonths',
  'availability',
  'rating',
  'solarReady',
];

/** Next.js `searchParams` shape. */
export type SearchParamsInput = Record<string, string | string[] | undefined>;

function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean);
}

function toInt(value: string | string[] | undefined): number | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return undefined;
  const n = Number.parseInt(first, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse a URL query into a validated `ProductQuery`.
 *
 * Every listing surface — category, subcategory and search — goes through this
 * one function, so filter state is always shareable and back-button correct.
 */
export function parseProductQuery(
  params: SearchParamsInput,
  base: { category?: CategorySlug; subcategory?: string } = {},
): ProductQuery {
  const filters: Partial<Record<FacetId, string[]>> = {};
  for (const id of URL_FACET_IDS) {
    const values = toArray(params[id]);
    if (values.length > 0) filters[id] = values;
  }

  const sortParam = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: SortId = sortParam && isSortId(sortParam) ? sortParam : DEFAULT_SORT;

  const priceMinRupees = toInt(params.priceMin);
  const priceMaxRupees = toInt(params.priceMax);
  const page = Math.max(1, toInt(params.page) ?? 1);
  const searchRaw = Array.isArray(params.q) ? params.q[0] : params.q;

  return {
    category: base.category,
    subcategory: base.subcategory,
    search: searchRaw?.trim() || undefined,
    filters,
    priceMin: priceMinRupees !== undefined ? priceMinRupees * 100 : undefined,
    priceMax: priceMaxRupees !== undefined ? priceMaxRupees * 100 : undefined,
    minRating: filters.rating?.length
      ? Math.min(...filters.rating.map((r) => Number(r)).filter(Number.isFinite))
      : undefined,
    sort,
    page,
    perPage: PER_PAGE,
  };
}

/** Serialise a query back to a `URLSearchParams` string (without the leading `?`). */
export function buildQueryString(query: ProductQuery, overrides: Partial<ProductQuery> = {}): string {
  const merged: ProductQuery = { ...query, ...overrides };
  const params = new URLSearchParams();

  if (merged.search) params.set('q', merged.search);

  for (const id of URL_FACET_IDS) {
    const values = merged.filters[id];
    if (values && values.length > 0) params.set(id, values.join(','));
  }

  if (merged.priceMin !== undefined) params.set('priceMin', String(Math.round(merged.priceMin / 100)));
  if (merged.priceMax !== undefined) params.set('priceMax', String(Math.round(merged.priceMax / 100)));
  if (merged.sort && merged.sort !== DEFAULT_SORT) params.set('sort', merged.sort);
  if (merged.page && merged.page > 1) params.set('page', String(merged.page));

  return params.toString();
}

/** Toggle one value inside one facet, resetting pagination. */
export function toggleFacetValue(
  query: ProductQuery,
  facetId: FacetId,
  value: string,
): ProductQuery {
  const current = query.filters[facetId] ?? [];
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];

  const filters = { ...query.filters };
  if (next.length > 0) filters[facetId] = next;
  else delete filters[facetId];

  return { ...query, filters, page: 1 };
}

export function clearFacet(query: ProductQuery, facetId: FacetId): ProductQuery {
  const filters = { ...query.filters };
  delete filters[facetId];
  return { ...query, filters, page: 1 };
}

export function clearAllFilters(query: ProductQuery): ProductQuery {
  return { ...query, filters: {}, priceMin: undefined, priceMax: undefined, page: 1 };
}

/** Count of active refinements, used for the mobile filter badge. */
export function activeFilterCount(query: ProductQuery): number {
  const facetCount = Object.values(query.filters).reduce((n, v) => n + (v?.length ?? 0), 0);
  const priceCount = query.priceMin !== undefined || query.priceMax !== undefined ? 1 : 0;
  return facetCount + priceCount;
}
