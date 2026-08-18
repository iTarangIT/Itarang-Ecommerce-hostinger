/**
 * Commerce domain types.
 *
 * These are the *only* shapes the UI is allowed to know about. Mock data today
 * and the Hostinger Ecommerce API later both normalise into these types, so the
 * front end never depends on a particular backend's payload shape.
 *
 * Money is always an integer in paise (₹1 = 100) to avoid float drift.
 */

export type Paise = number;

export type CategorySlug = 'inverters' | 'batteries' | 'ups' | 'combos';

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Short label used in compact nav contexts. */
  shortName: string;
  tagline: string;
  description: string;
  /** Longer SEO/editorial copy rendered at the foot of the category page. */
  seoCopy: string[];
  icon: ProductArtKind;
  subcategories: Subcategory[];
  /** Facet ids surfaced for this category, in display order. */
  facetIds: FacetId[];
  /** Highlights shown in the mega menu column. */
  highlights: string[];
}

export interface Subcategory {
  slug: string;
  name: string;
  description: string;
  seoCopy: string[];
}

export type ProductArtKind = 'inverter' | 'battery' | 'ups' | 'combo';

export type BadgeKind =
  | 'bestseller'
  | 'new'
  | 'sale'
  | 'combo-saver'
  | 'premium'
  | 'low-stock'
  | 'sold-out';

export type Availability = 'in-stock' | 'low-stock' | 'out-of-stock' | 'preorder';

export interface Price {
  /** Maximum retail price, inclusive of taxes. */
  mrp: Paise;
  /** Actual selling price, inclusive of taxes. */
  selling: Paise;
}

export interface ProductVariant {
  id: string;
  sku: string;
  /** Human label, e.g. "1100VA + 150Ah Lithium". */
  title: string;
  /** Values keyed by option id, e.g. { capacity: '1100VA', battery: '150Ah Lithium' }. */
  optionValues: Record<string, string>;
  price: Price;
  availability: Availability;
  /** Units on hand; drives the low-stock badge and quantity ceiling. */
  stock: number;
}

export interface ProductOption {
  id: string;
  name: string;
  values: string[];
}

export interface SpecGroup {
  title: string;
  specs: Array<{ label: string; value: string }>;
}

export interface ProductFaq {
  question: string;
  answer: string;
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Index 0 = 1★ … index 4 = 5★. */
  distribution: [number, number, number, number, number];
}

export interface Review {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  /** Reviewer is identified by city + verification state only — no personal data. */
  city: string;
  verifiedPurchase: boolean;
  /** ISO date. */
  createdAt: string;
  helpfulCount: number;
  hasPhotos: boolean;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: CategorySlug;
  subcategory: string;
  art: ProductArtKind;
  /** Image paths, first is the primary. */
  images: string[];
  /** Terse selling points shown on the PDP above the fold. */
  highlights: string[];
  description: string[];
  specGroups: SpecGroup[];
  boxContents: string[];
  faqs: ProductFaq[];
  /**
   * Warranty length in months, or `undefined` when the source catalogue does
   * not state one.
   *
   * Optional on purpose. A warranty is a commercial promise a customer can act
   * on, so an unknown warranty must render as *nothing* rather than as a
   * plausible default — a product silently advertising "2-year warranty"
   * because no better value was available is worse than showing no figure.
   */
  warrantyMonths?: number;
  /** Free professional installation included? */
  installationIncluded: boolean;
  badges: BadgeKind[];
  options: ProductOption[];
  variants: ProductVariant[];
  rating: RatingSummary | null;
  /** Structured facet values used by the listing filters. */
  facets: ProductFacetValues;
  /** Product ids commonly bought with this one. */
  frequentlyBoughtWith: string[];
  relatedProductIds: string[];
  /** Sort input for "Newest"; ISO date. */
  launchedAt: string;
  /** Sort input for "Best selling"; lower is better. Mock ranking today. */
  popularityRank: number;
}

export interface ProductFacetValues {
  /** Inverter/UPS output rating in VA. */
  capacityVa?: number;
  /** Battery capacity in Ah. */
  batteryAh?: number;
  technology?: string;
  /** Typical backup at the reference load, in hours. */
  backupHours?: number;
  /** Absent when unknown, so the warranty facet simply omits the product. */
  warrantyMonths?: number;
  phase?: string;
  solarReady?: boolean;
}

/* ------------------------------------------------------------------ facets */

export type FacetId =
  | 'category'
  | 'subcategory'
  | 'capacityVa'
  | 'batteryAh'
  | 'technology'
  | 'backupHours'
  | 'warrantyMonths'
  | 'price'
  | 'availability'
  | 'rating'
  | 'solarReady';

export type FacetType = 'checkbox' | 'range' | 'rating' | 'toggle';

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export interface FacetGroup {
  id: FacetId;
  label: string;
  type: FacetType;
  /** Present for checkbox / rating facets. */
  options?: FacetOption[];
  /** Present for range facets — values in the facet's native unit. */
  min?: number;
  max?: number;
  /** Unit suffix for range facets, e.g. "VA". */
  unit?: string;
  /** Collapse by default in the sidebar. */
  collapsedByDefault?: boolean;
}

export type SortId =
  | 'featured'
  | 'best-selling'
  | 'newest'
  | 'price-asc'
  | 'price-desc'
  | 'rating-desc'
  | 'discount-desc'
  | 'name-asc';

export interface SortOption {
  id: SortId;
  label: string;
}

/** Parsed, validated listing query — the single source of truth for a PLP. */
export interface ProductQuery {
  category?: CategorySlug;
  subcategory?: string;
  search?: string;
  /** Multi-select facet selections keyed by facet id. */
  filters: Partial<Record<FacetId, string[]>>;
  priceMin?: Paise;
  priceMax?: Paise;
  minRating?: number;
  sort: SortId;
  page: number;
  perPage: number;
}

export interface ProductListResult {
  items: Product[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  facets: FacetGroup[];
  /** Price bounds across the *unfiltered* result set, for the range control. */
  priceBounds: { min: Paise; max: Paise };
}

export interface SearchSuggestion {
  type: 'product' | 'category' | 'query' | 'page';
  label: string;
  sublabel?: string;
  href: string;
  image?: string;
  price?: Price;
}

/* ------------------------------------------------------------------ offers */

export type OfferKind = 'bank' | 'upi' | 'emi' | 'coupon' | 'shipping' | 'bundle';

export interface Offer {
  id: string;
  kind: OfferKind;
  title: string;
  detail: string;
  /** Coupon code, when the offer is code-driven. */
  code?: string;
  termsUrl?: string;
  /** Restrict to categories; empty means site-wide. */
  categories?: CategorySlug[];
  /** Minimum cart value in paise. */
  minCart?: Paise;
  /** ISO date; used by countdown surfaces. */
  endsAt?: string;
}

/* ------------------------------------------------------- provider contract */

/**
 * The seam between the UI and any commerce backend.
 *
 * `MockCatalogProvider` implements this today. `HostingerCatalogProvider` will
 * implement the same interface against api-ecommerce.hostinger.com, at which
 * point no component or page needs to change.
 */
export interface CatalogProvider {
  readonly name: string;

  listCategories(): Promise<Category[]>;
  getCategory(slug: string): Promise<Category | null>;

  listProducts(query: ProductQuery): Promise<ProductListResult>;
  getProduct(slug: string): Promise<Product | null>;
  getProductsByIds(ids: string[]): Promise<Product[]>;

  getReviews(productId: string): Promise<Review[]>;

  suggest(term: string): Promise<SearchSuggestion[]>;

  listOffers(): Promise<Offer[]>;
}
