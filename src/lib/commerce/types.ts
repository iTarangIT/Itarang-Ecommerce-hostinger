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

/**
 * Presentation hint for a single option value.
 *
 * Only meaningful on a `kind: 'color'` option, where the buy box draws a
 * circular chip instead of a text pill. `hex` paints the chip directly; `image`
 * wins when the finish is a texture a flat colour cannot honestly stand in for.
 */
export interface OptionSwatch {
  value: string;
  hex?: string;
  image?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  values: string[];
  /**
   * How the value list is drawn. Absent means `'text'`, which is what every
   * option in the catalogue was before swatches existed.
   */
  kind?: 'text' | 'color';
  /** One entry per value, in any order. Missing entries fall back to text. */
  swatches?: OptionSwatch[];
}

export interface SpecGroup {
  title: string;
  specs: Array<{ label: string; value: string }>;
}

export interface ProductFaq {
  question: string;
  answer: string;
}

/**
 * A free-form comparison table shown under "What is in the box".
 *
 * Deliberately untyped beyond strings: the columns differ per category (a
 * battery compares capacity against weight and backup, a combo compares its
 * bundled parts), and inventing a shared schema for that would fit neither.
 */
export interface SizeChart {
  title: string;
  /** First column heads the merged group cell, e.g. ['Size','Includes','Measurement']. */
  columns: string[];
  /**
   * One entry per group. `label` fills the first column across the group's
   * rows as a single merged cell, so a size that includes three parts states
   * its name once rather than three times.
   */
  groups: Array<{ label: string; rows: string[][] }>;
}

/** Legal Metrology seller block. Absent unless the catalogue states one. */
export interface SellerInfo {
  name: string;
  address: string;
  packedBy?: string;
  /**
   * The four fields below arrived with the DB-backed catalogue, where a seller
   * is a shared row rather than a per-product literal. Every one is optional
   * for the same reason `legalName` is on the manufacturer: a source that does
   * not state a grievance officer must render no grievance officer.
   */
  customerCarePhone?: string;
  customerCareEmail?: string;
  gstin?: string;
  grievanceOfficer?: string;
}

/**
 * Who made it, as distinct from who sells it.
 *
 * These were one field until the catalogue held products whose manufacturer and
 * marketer are different companies — the PDP's "Manufacturer Detail" card was
 * rendering `seller`. Legal Metrology wants both stated, so both exist.
 *
 * Only `name` is required. A catalogue that has not confirmed a legal name or a
 * registered address states neither rather than guessing one.
 */
export interface ManufacturerInfo {
  name: string;
  legalName?: string;
  address?: string;
  website?: string;
  email?: string;
  phone?: string;
  countryOfOrigin?: string;
}

/**
 * The rich, category-shaped blocks a product page carries below the fold.
 *
 * A discriminated union rather than a bag of optional arrays: the six kinds
 * have six genuinely different shapes, and the renderer switches on `kind`
 * exactly once. A product renders whichever sections it has and nothing else —
 * a home storage battery has no discharge cut-off to talk about, and is not
 * given an empty section to prove it.
 */
export type ProductSection =
  | { kind: 'applications'; items: Array<{ title: string; description: string }> }
  | {
      kind: 'charging' | 'discharge';
      summary: string;
      points: Array<{ label: string; value: string }>;
    }
  | {
      kind: 'runtime';
      summary: string;
      scenarios: Array<{ load: string; draw: string; runtime: string }>;
    }
  | { kind: 'compatibility' | 'care'; items: string[] };

export type ProductSectionKind = ProductSection['kind'];

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
  /**
   * Catalogue identity as the manufacturer states it.
   *
   * Optional because the two older providers cannot supply it: the mock
   * catalogue predates the fields, and the Hostinger API returns a title and
   * nothing structured behind it. A product that does not state a model number
   * shows no model number.
   */
  brand?: string;
  model?: string;
  genericName?: string;
  productType?: string;
  /** Legal Metrology net quantity, e.g. "1 Count". */
  netQuantity?: string;
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
  /**
   * The four sections below are optional for the same reason `warrantyMonths`
   * is: they are claims a customer can act on. A product whose source
   * catalogue states none of them renders no care block, no size chart, no
   * seller panel and no return window — never a plausible-looking default.
   */
  careInstructions?: string[];
  sizeChart?: SizeChart;
  seller?: SellerInfo;
  /** Who made it. Rendered separately from `seller`; see `ManufacturerInfo`. */
  manufacturer?: ManufacturerInfo;
  /** HSN code and GST rate as a fraction (0.18 = 18%), when the source states them. */
  hsnCode?: string;
  taxRate?: number;
  /** Return window in days, e.g. 7. */
  returnWindowDays?: number;
  faqs: ProductFaq[];
  /**
   * Category-shaped page blocks — applications, charging, discharge, run times,
   * compatibility, care. Absent, or a subset, for products whose catalogue
   * states none of it.
   */
  sections?: ProductSection[];
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
  /**
   * The same promise in the two other forms a battery warranty is written in.
   *
   * `warrantyText` is the verbatim commercial phrase — "3 years or 1200 cycles,
   * whichever is earlier" — which is what the customer is actually offered and
   * what a months figure alone cannot express. `warrantyCycles` is the machine
   * readable half of it. Both follow `warrantyMonths`: unknown renders as
   * nothing.
   */
  warrantyCycles?: number;
  warrantyText?: string;
  /** Free professional installation included? */
  installationIncluded: boolean;
  /**
   * Whether this product is advertised with no-cost EMI.
   *
   * Optional, and absent means no — the same rule the warranty follows, for the
   * same reason. No-cost EMI is a financing arrangement somebody has to have
   * agreed with a lender, and it used to be printed on every product priced
   * over ₹5,000 because a price threshold stood in for that agreement.
   *
   * A provider that sets this is asserting the specific terms `PriceBlock`
   * renders, not merely that instalments are possible.
   */
  emiEnabled?: boolean;
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
  /**
   * Nominal pack voltage.
   *
   * Irrelevant to a home inverter battery, which is always 12V, and the single
   * most important number on a traction pack — a 51V pack and a 73.6V pack are
   * not alternatives for the same vehicle. Optional like every other facet
   * value, so nothing that does not state it is filed under a guess.
   */
  voltage?: number;
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
  | 'voltage'
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
