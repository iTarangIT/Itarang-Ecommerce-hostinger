import type { CategorySlug, FacetId, ProductQuery, SortId } from '@/lib/commerce/types';
import { FACET_DEFINITIONS } from './facets';
import { DEFAULT_SORT, isSortId } from './sort';

export const PER_PAGE = 12;

/** Facets that appear in the URL as repeatable multi-select params. */
export const URL_FACET_IDS: FacetId[] = [
  'category',
  'subcategory',
  'capacityVa',
  'technology',
  'backupHours',
  'warrantyMonths',
  'availability',
  'rating',
  'solarReady',
];

/**
 * Range facets, and the URL parameter pair each one uses.
 *
 * Written out rather than derived from the facet id so the query string stays
 * readable and stable: `priceMin`/`priceMax` are what shared links and search
 * engines already carry, and renaming them to fit a scheme would break every
 * one of those for no gain.
 *
 * `scale` is what the URL is divided by. Price is stored in paise and shown in
 * rupees, which is the only reason that conversion existed as a special case;
 * capacity and voltage are already in the unit a shopper reads, so their scale
 * is 1 and the same code path serves all three.
 */
export const URL_RANGE_FACETS: ReadonlyArray<{
  id: FacetId;
  param: string;
  scale: number;
}> = [
  { id: 'price', param: 'price', scale: 100 },
  { id: 'batteryAh', param: 'ah', scale: 1 },
  { id: 'voltage', param: 'volt', scale: 1 },
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
 * A decimal from the URL.
 *
 * `parseInt` truncates, and the catalogue's voltages are 12.8, 25.6, 60.8 and
 * 73.6 — a `voltMax=73.6` read as 73 would exclude the very pack whose voltage
 * set the upper bound, so a shopper who dragged the slider to its maximum would
 * watch a product disappear.
 */
function toFloat(value: string | string[] | undefined): number | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (!first) return undefined;
  const n = Number.parseFloat(first);
  return Number.isFinite(n) ? n : undefined;
}

/** Trim a range value to the facet's own precision, so URLs stay tidy. */
function roundTo(value: number, precision: number | undefined): number {
  const factor = 10 ** (precision ?? 0);
  return Math.round(value * factor) / factor;
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

  const ranges: Partial<Record<FacetId, { min?: number; max?: number }>> = {};
  for (const { id, param, scale } of URL_RANGE_FACETS) {
    const rawMin = toFloat(params[`${param}Min`]);
    const rawMax = toFloat(params[`${param}Max`]);
    if (rawMin === undefined && rawMax === undefined) continue;

    let min = rawMin !== undefined ? rawMin * scale : undefined;
    let max = rawMax !== undefined ? rawMax * scale : undefined;

    // An inverted window — from a hand-edited URL, or a stale link after the
    // catalogue moved — used to match nothing at all and look like a broken
    // filter. Swapping reads it as the range the shopper plainly meant.
    if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];

    // Negative bounds cannot describe a price, a capacity or a voltage.
    if (min !== undefined && min < 0) min = 0;
    if (max !== undefined && max < 0) max = 0;

    ranges[id] = { min, max };
  }

  const page = Math.max(1, toInt(params.page) ?? 1);
  const searchRaw = Array.isArray(params.q) ? params.q[0] : params.q;

  return {
    category: base.category,
    subcategory: base.subcategory,
    search: searchRaw?.trim() || undefined,
    filters,
    ranges,
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

  for (const { id, param, scale } of URL_RANGE_FACETS) {
    const range = merged.ranges[id];
    if (!range) continue;
    const precision = FACET_DEFINITIONS[id].precision;
    if (range.min !== undefined) {
      params.set(`${param}Min`, String(roundTo(range.min / scale, precision)));
    }
    if (range.max !== undefined) {
      params.set(`${param}Max`, String(roundTo(range.max / scale, precision)));
    }
  }

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

/** Narrow one range facet, or clear it by passing two undefined bounds. */
export function setFacetRange(
  query: ProductQuery,
  facetId: FacetId,
  min: number | undefined,
  max: number | undefined,
): ProductQuery {
  const ranges = { ...query.ranges };
  if (min === undefined && max === undefined) delete ranges[facetId];
  else ranges[facetId] = { min, max };
  return { ...query, ranges, page: 1 };
}

export function clearFacet(query: ProductQuery, facetId: FacetId): ProductQuery {
  const filters = { ...query.filters };
  delete filters[facetId];
  const ranges = { ...query.ranges };
  delete ranges[facetId];
  return { ...query, filters, ranges, page: 1 };
}

export function clearAllFilters(query: ProductQuery): ProductQuery {
  return { ...query, filters: {}, ranges: {}, page: 1 };
}

/** Count of active refinements, used for the mobile filter badge. */
export function activeFilterCount(query: ProductQuery): number {
  const facetCount = Object.values(query.filters).reduce((n, v) => n + (v?.length ?? 0), 0);
  // One per narrowed range, however many ends of it were set — a shopper who
  // gave both a floor and a ceiling for voltage has applied one filter, not two.
  const rangeCount = Object.values(query.ranges).filter(
    (range) => range && (range.min !== undefined || range.max !== undefined),
  ).length;
  return facetCount + rangeCount;
}
