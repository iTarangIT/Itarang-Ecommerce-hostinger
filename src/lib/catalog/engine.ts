import type {
  FacetGroup,
  FacetId,
  FacetRange,
  Product,
  ProductListResult,
  ProductQuery,
  SearchSuggestion,
} from '@/lib/commerce/types';
import { FACET_DEFINITIONS, productMatchesFacet } from './facets';
import { categoryName, subcategoryName } from './category-names';
import { displayPrice, minSellingPrice } from './pricing';
import { sortProducts } from './sort';
import { categoryPath, productPath, subcategoryPath } from '@/lib/routes';

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

/**
 * Facets shown on search results, where no single category is in scope.
 *
 * `subcategory` and `voltage` were both missing. A shopper who searched
 * "lithium" landed on a page that could not tell a home battery from a traction
 * pack, and could not filter by the one number that decides whether a pack fits
 * their vehicle at all — the two refinements search results need most.
 */
export const SEARCH_FACET_IDS: FacetId[] = [
  'category',
  'subcategory',
  'batteryAh',
  'voltage',
  'technology',
  'warrantyMonths',
  'rating',
  'availability',
];

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+.]+/g, ' ').trim();
}

/**
 * Query words that mean something in this catalogue but do not appear in it.
 *
 * Each entry maps a token a shopper types to a **phrase** matched against the
 * corpus, and the phrase form is the point. "2w" expanding to the two loose
 * tokens `2` and `wheeler` would match a 3-wheeler pack just as well, because
 * both corpora contain the word "wheeler"; expanding it to the contiguous
 * string "2 wheeler" matches one and not the other.
 *
 * Kept deliberately short and derived from vocabulary that is already in the
 * catalogue — subcategory names and the LiFePO4 chemistry — rather than a
 * general thesaurus. A synonym nobody can point at a product for is how a
 * search starts returning things that are merely adjacent.
 */
const QUERY_ALIASES: ReadonlyMap<string, string> = new Map([
  ['2w', '2 wheeler'],
  ['3w', '3 wheeler'],
  ['2wheeler', '2 wheeler'],
  ['3wheeler', '3 wheeler'],
  ['erickshaw', 'rickshaw'],
  ['rikshaw', 'rickshaw'],
  ['ev2', '2 wheeler'],
  ['ev3', '3 wheeler'],
  ['lfp', 'lifepo4'],
  ['lithiumion', 'lithium'],
  ['ess', 'energy storage'],
  ['chargers', 'charger'],
]);

/**
 * Everything a product can be found by.
 *
 * Three additions, each answering a search the meeting found returned nothing:
 *
 *   **Category and subcategory display names.** The corpus carried the *slugs*
 *   — `batteries`, `ev-3-wheeler` — and nothing else, so the word "rickshaw"
 *   appeared nowhere at all: it lives only in the name "3-Wheeler & E-Rickshaw
 *   Batteries". Searching for the product line by the word the business itself
 *   uses for it returned an empty page.
 *
 *   **Brand and model.** `Product.model` is the manufacturer's own identity —
 *   "TK-LiFe-6145" — and was not indexed, so a customer reading it off a
 *   quotation could not search for it. Variant SKUs were already here.
 *
 *   **Voltage.** Indexed as `51v` and as the bare `51`, matching how `batteryAh`
 *   is already handled. A traction pack is chosen by voltage first, so "51V"
 *   not matching anything was the single worst gap in the list.
 */
function searchCorpus(product: Product): string {
  const { voltage, batteryAh, capacityVa } = product.facets;
  return normalise(
    [
      product.title,
      product.subtitle,
      product.brand ?? '',
      product.model ?? '',
      product.category,
      categoryName(product.category),
      product.subcategory,
      subcategoryName(product.subcategory),
      product.facets.technology ?? '',
      capacityVa ? `${capacityVa}va ${capacityVa}` : '',
      batteryAh ? `${batteryAh}ah ${batteryAh}` : '',
      voltage ? `${voltage}v ${voltage}` : '',
      product.highlights.join(' '),
      product.variants.map((v) => v.sku).join(' '),
    ].join(' '),
  );
}

/**
 * A query, reduced to the terms worth matching.
 *
 * Two rules, and between them they are what fixes the reported searches.
 *
 * **A lone digit joins the word after it.** "2 wheeler" and "2-wheeler" both
 * normalise to the tokens `2` and `wheeler`, and on their own those match every
 * traction pack we sell, because a 3-wheeler pack is also a "wheeler". Joined
 * into the phrase "2 wheeler" they match the two-wheeler line and nothing else
 * — the same result the `2w` alias produces, which is the point: a shopper
 * should not get a different answer for typing the abbreviation than for typing
 * it out. The digit is only ever joined forwards, so "105" or "51" — real
 * capacities and voltages — are untouched; this applies to single digits alone.
 *
 * **Single characters are dropped**, which is what fixes "e-rickshaw".
 * `normalise` splits it into `e` and `rickshaw`; `score` requires *every* token
 * to match something, so the stray `e` — which matches no word in any product —
 * failed the whole query before `rickshaw` was ever considered. A one-letter
 * fragment left over from splitting a hyphenated word carries no meaning on its
 * own, so it cannot be allowed to veto the word that does.
 */
function queryTerms(term: string): string[] {
  const raw = normalise(term).split(' ').filter(Boolean);

  const joined: string[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i];
    const next = raw[i + 1];
    if (/^\d$/.test(token) && next && !/^\d/.test(next)) {
      joined.push(`${token} ${next}`);
      i += 1;
      continue;
    }
    joined.push(token);
  }

  return joined
    .map((token) => QUERY_ALIASES.get(token) ?? token)
    .filter((token) => token.length > 1);
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

/** Every facet that filters on a number, in `FACET_DEFINITIONS` order. */
const RANGE_FACET_IDS = (Object.keys(FACET_DEFINITIONS) as FacetId[]).filter(
  (id) => FACET_DEFINITIONS[id].type === 'range',
);

/**
 * Does a product fall inside the window selected for one range facet?
 *
 * A product that states no value for the facet is **excluded** as soon as the
 * shopper narrows it, and included while they have not. That asymmetry is
 * deliberate and matches how the checkbox facets behave: filtering by voltage
 * is a statement about voltage, and a product whose voltage nobody recorded
 * cannot be claimed to satisfy it — but neither should it vanish from an
 * unfiltered listing.
 */
function withinRange(product: Product, facetId: FacetId, range?: FacetRange): boolean {
  if (!range || (range.min === undefined && range.max === undefined)) return true;

  const value = FACET_DEFINITIONS[facetId].rangeValueOf?.(product);
  if (value === undefined) return false;

  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
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

  /**
   * Relevance score for a product against a search term; 0 means no match.
   *
   * The weights are unchanged — title 6, corpus 3, fuzzy 1 — and so is the rule
   * that every term must match something. Widening *that* would be how a
   * catalogue of eight batteries starts answering every query with all eight.
   * What changed is only which terms are asked for (`queryTerms`) and what
   * there is to match them against (`searchCorpus`).
   *
   * A term reaching here may be a phrase from `QUERY_ALIASES` — "2 wheeler" —
   * which is why `includes` on the whole corpus string carries the weight: the
   * phrase has to appear contiguously, so a 3-wheeler pack is not a match for a
   * 2-wheeler query. `isNearMatch` is per-word and is skipped for phrases,
   * which is correct: fuzzy matching a multi-word phrase against a single word
   * cannot succeed and should not be attempted.
   */
  score(product: Product, term: string): number {
    const tokens = queryTerms(term);
    if (tokens.length === 0) return 1;

    const corpus = this.corpus.get(product.id) ?? '';
    const words = corpus.split(' ');
    const title = normalise(product.title);

    let score = 0;
    for (const token of tokens) {
      if (title.includes(token)) score += 6;
      else if (corpus.includes(token)) score += 3;
      else if (!token.includes(' ') && words.some((w) => isNearMatch(token, w))) score += 1;
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
      for (const facetId of RANGE_FACET_IDS) {
        if (facetId === skip) continue;
        if (!withinRange(product, facetId, query.ranges[facetId])) return false;
      }
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
        // Only products that state the figure contribute to the scale. A pack
        // with no recorded voltage must not drag the minimum to zero and give
        // the slider two-thirds of a track nothing lives in.
        const values = pool
          .map((product) => def.rangeValueOf?.(product))
          .filter((value): value is number => value !== undefined);

        // A single distinct value is not a range — one product, or four that
        // all read 12.8 V, gives a slider with nowhere to go. The facet is
        // dropped unless the shopper has already narrowed by it, which mirrors
        // the "fewer than two options" rule the checkbox facets use below.
        const distinct = new Set(values);
        if (distinct.size < 2 && !query.ranges[id]) continue;
        if (values.length === 0) continue;

        groups.push({
          id,
          label: def.label,
          type: 'range',
          min: Math.min(...values),
          max: Math.max(...values),
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

    // Bounds from the *base* set, before facets, so a slider's track is the
    // whole catalogue in scope rather than whatever is left after the shopper
    // has already used it.
    const rangeBounds: ProductListResult['rangeBounds'] = {};
    for (const id of RANGE_FACET_IDS) {
      const values = base
        .map((product) => FACET_DEFINITIONS[id].rangeValueOf?.(product))
        .filter((value): value is number => value !== undefined);
      if (values.length === 0) continue;
      rangeBounds[id] = { min: Math.min(...values), max: Math.max(...values) };
    }

    return {
      items: sorted.slice(start, start + query.perPage),
      total,
      page,
      perPage: query.perPage,
      totalPages,
      facets,
      rangeBounds,
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
  categories: Array<{
    slug: string;
    name: string;
    tagline: string;
    subcategories: Array<{ slug: string; name: string; description: string }>;
  }>,
): SearchSuggestion[] {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  /**
   * Matched on the same terms the results page uses, so the dropdown and the
   * page it leads to agree. The old code matched the raw query against the
   * name in one piece, which meant "2W" suggested nothing — `QUERY_ALIASES` is
   * where that is known, and it lives in `queryTerms`.
   */
  const terms = queryTerms(trimmed);
  const matches = (name: string) => {
    const haystack = normalise(name);
    return terms.length > 0 && terms.every((t) => haystack.includes(t));
  };

  /**
   * A subcategory match offers the subcategory, not its parent.
   *
   * "e-rickshaw" used to suggest "Batteries" — technically the container of the
   * right answer, and one more click plus a filter away from it. The taxonomy
   * is one family deep now, so the parent suggestion on its own says almost
   * nothing; the useful navigational answer is always the subcategory.
   */
  const categoryHits: SearchSuggestion[] = [];
  for (const category of categories) {
    for (const sub of category.subcategories) {
      if (categoryHits.length >= 3) break;
      if (!matches(sub.name)) continue;
      categoryHits.push({
        type: 'category',
        label: sub.name,
        sublabel: sub.description,
        href: subcategoryPath(category.slug, sub.slug),
      });
    }
    if (categoryHits.length < 3 && matches(category.name)) {
      categoryHits.push({
        type: 'category',
        label: category.name,
        sublabel: category.tagline,
        href: categoryPath(category.slug),
      });
    }
  }

  const suggestions: SearchSuggestion[] = [
    ...categoryHits.slice(0, 3),
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
