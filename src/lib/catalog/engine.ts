import type {
  FacetGroup,
  FacetId,
  Product,
  ProductListResult,
  ProductQuery,
  SearchSuggestion,
} from '@/lib/commerce/types';
import { FACET_DEFINITIONS, productMatchesFacet } from './facets';
import { displayPrice, minSellingPrice } from './pricing';
import { sortProducts } from './sort';
import { categoryPath, productPath } from '@/lib/routes';

/**
 * In-memory catalogue query engine.
 *
 * Filtering, faceting, sorting, search and suggestions all live here so every
 * provider behaves identically. `MockCatalogProvider` and
 * `HostingerCatalogProvider` differ only in where their `Product[]` comes from
 * — never in how a shopper's query is answered.
 *
 * Construct one per catalogue snapshot; the search corpus is built once up
 * front and reused for every query against that snapshot.
 */

/** Facets shown on search results, where no single category is in scope. */
export const SEARCH_FACET_IDS: FacetId[] = [
  'category',
  'capacityVa',
  'batteryAh',
  'technology',
  'warrantyMonths',
  'price',
  'rating',
  'availability',
];

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+]+/g, ' ').trim();
}

function searchCorpus(product: Product): string {
  return normalise(
    [
      product.title,
      product.subtitle,
      product.category,
      product.subcategory,
      product.facets.technology ?? '',
      product.facets.capacityVa ? `${product.facets.capacityVa}va` : '',
      product.facets.batteryAh ? `${product.facets.batteryAh}ah` : '',
      product.highlights.join(' '),
      product.variants.map((v) => v.sku).join(' '),
    ].join(' '),
  );
}

/** Cheap Levenshtein-1 check so "invertor" still finds "inverter". */
function isNearMatch(token: string, word: string): boolean {
  if (Math.abs(token.length - word.length) > 1) return false;
  if (token.length < 5) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < token.length && j < word.length) {
    if (token[i] === word[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (token.length > word.length) i += 1;
    else if (token.length < word.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (token.length - i) + (word.length - j) <= 1;
}

function withinPrice(product: Product, min?: number, max?: number): boolean {
  const price = minSellingPrice(product);
  if (min !== undefined && price < min) return false;
  if (max !== undefined && price > max) return false;
  return true;
}

export class CatalogEngine {
  private readonly corpus: Map<string, string>;

  constructor(
    private readonly products: Product[],
    /** Facet ids to surface per category; falls back to `SEARCH_FACET_IDS`. */
    private readonly facetIdsForCategory: (category: string) => FacetId[] = () => SEARCH_FACET_IDS,
  ) {
    this.corpus = new Map(products.map((p) => [p.id, searchCorpus(p)]));
  }

  get all(): Product[] {
    return this.products;
  }

  /** Relevance score for a product against a search term; 0 means no match. */
  score(product: Product, term: string): number {
    const tokens = normalise(term).split(' ').filter(Boolean);
    if (tokens.length === 0) return 1;

    const corpus = this.corpus.get(product.id) ?? '';
    const words = corpus.split(' ');
    const title = normalise(product.title);

    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) score += 6;
      else if (corpus.includes(token)) score += 3;
      else if (words.some((w) => isNearMatch(token, w))) score += 1;
      else return 0; // every token must match somehow
    }
    if (title.startsWith(tokens[0])) score += 4;
    return score;
  }

  /** Base set for a query: category / subcategory / search scope, before facets. */
  private baseSet(query: ProductQuery): Product[] {
    let set = this.products;
    if (query.category) set = set.filter((p) => p.category === query.category);
    if (query.subcategory) set = set.filter((p) => p.subcategory === query.subcategory);
    if (query.search) {
      const term = query.search;
      set = set.filter((p) => this.score(p, term) > 0);
    }
    return set;
  }

  /**
   * Apply every facet selection except `skip`.
   *
   * Skipping the facet being counted is what makes facet counts behave the way
   * shoppers expect: selecting "900 VA" must not collapse the other capacity
   * options to zero.
   */
  private applyFacets(products: Product[], query: ProductQuery, skip?: FacetId): Product[] {
    return products.filter((product) => {
      for (const [facetId, selected] of Object.entries(query.filters) as Array<
        [FacetId, string[]]
      >) {
        if (facetId === skip) continue;
        if (!productMatchesFacet(product, facetId, selected)) return false;
      }
      if (skip !== 'price' && !withinPrice(product, query.priceMin, query.priceMax)) return false;
      return true;
    });
  }

  private buildFacetGroups(
    base: Product[],
    query: ProductQuery,
    facetIds: FacetId[],
  ): FacetGroup[] {
    const groups: FacetGroup[] = [];

    for (const id of facetIds) {
      const def = FACET_DEFINITIONS[id];
      const pool = this.applyFacets(base, query, id);

      if (def.type === 'range') {
        const prices = pool.map(minSellingPrice);
        if (prices.length === 0) continue;
        groups.push({
          id,
          label: def.label,
          type: 'range',
          min: Math.min(...prices),
          max: Math.max(...prices),
          unit: def.unit,
          collapsedByDefault: def.collapsedByDefault,
        });
        continue;
      }

      const counts = new Map<string, number>();
      for (const product of pool) {
        for (const value of def.valuesOf(product)) {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
      // Keep selected values visible even when their count has fallen to zero.
      for (const selected of query.filters[id] ?? []) {
        if (!counts.has(selected)) counts.set(selected, 0);
      }
      if (counts.size === 0) continue;

      const options = [...counts.entries()]
        .map(([value, count]) => ({ value, label: def.labelOf(value), count }))
        .sort((a, b) => {
          if (def.order) return def.order(a.value) - def.order(b.value);
          return a.label.localeCompare(b.label);
        });

      if (def.type !== 'toggle' && options.length < 2 && !query.filters[id]?.length) continue;

      groups.push({
        id,
        label: def.label,
        type: def.type,
        options,
        unit: def.unit,
        collapsedByDefault: def.collapsedByDefault,
      });
    }

    return groups;
  }

  list(query: ProductQuery): ProductListResult {
    const base = this.baseSet(query);
    const filtered = this.applyFacets(base, query);

    const facetIds = query.category
      ? this.facetIdsForCategory(query.category)
      : SEARCH_FACET_IDS;

    // On a subcategory page the subcategory facet is redundant with the URL.
    const visibleFacetIds = query.subcategory
      ? facetIds.filter((id) => id !== 'subcategory')
      : facetIds;

    const facets = this.buildFacetGroups(base, query, visibleFacetIds);

    const sorted =
      query.search && query.sort === 'featured'
        ? [...filtered].sort((a, b) => this.score(b, query.search!) - this.score(a, query.search!))
        : sortProducts(filtered, query.sort);

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / query.perPage));
    const page = Math.min(query.page, totalPages);
    const start = (page - 1) * query.perPage;

    const basePrices = base.map(minSellingPrice);

    return {
      items: sorted.slice(start, start + query.perPage),
      total,
      page,
      perPage: query.perPage,
      totalPages,
      facets,
      priceBounds: {
        min: basePrices.length ? Math.min(...basePrices) : 0,
        max: basePrices.length ? Math.max(...basePrices) : 0,
      },
    };
  }

  /** Ranked product hits for the search overlay. */
  productSuggestions(term: string, limit = 6): Product[] {
    return this.products
      .map((p) => ({ p, score: this.score(p, term) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((h) => h.p);
  }
}

/** Shared suggestion assembly, so both providers return the same shape. */
export function buildSuggestions(
  term: string,
  products: Product[],
  categories: Array<{ slug: string; name: string; tagline: string; subcategories: Array<{ name: string }> }>,
): SearchSuggestion[] {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const needle = normalise(trimmed);

  const categoryHits = categories
    .filter(
      (c) =>
        normalise(c.name).includes(needle) ||
        c.subcategories.some((s) => normalise(s.name).includes(needle)),
    )
    .slice(0, 3);

  const suggestions: SearchSuggestion[] = [
    ...categoryHits.map<SearchSuggestion>((c) => ({
      type: 'category',
      label: c.name,
      sublabel: c.tagline,
      href: categoryPath(c.slug),
    })),
    ...products.map<SearchSuggestion>((p) => ({
      type: 'product',
      label: p.title,
      sublabel: p.subtitle,
      href: productPath(p.slug),
      image: p.images[0],
      price: displayPrice(p),
    })),
  ];

  if (suggestions.length > 0) {
    suggestions.push({
      type: 'query',
      label: `See all results for “${trimmed}”`,
      href: `/search?q=${encodeURIComponent(trimmed)}`,
    });
  }

  return suggestions;
}
