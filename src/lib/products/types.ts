/**
 * The product catalogue we own.
 *
 * These are the *record* types — what a row in `products` and its children
 * actually contain, including the fields only an administrator sees (status,
 * who last edited it, the Hostinger reference, an unpriced variant). They are
 * deliberately not the same as `commerce/types.ts` `Product`, which is the
 * shopper-facing projection and must never carry a draft, a null price or an
 * editor's email.
 *
 * `to-domain.ts` is the one place a record becomes a `Product`.
 *
 * Money is integer paise, as everywhere else.
 */

import type {
  Availability,
  BadgeKind,
  CategorySlug,
  Paise,
  ProductArtKind,
  ProductFacetValues,
  ProductFaq,
  ProductSection,
  SpecGroup,
} from '@/lib/commerce/types';

export type ProductStatus = 'draft' | 'published' | 'archived';

/**
 * What an image shows.
 *
 * Named after the roles the supplied catalogue actually uses rather than
 * invented generic slots: the source set is four composed marketing images per
 * product — the pack, its dimensions, its electrical rating and a full listing
 * card — not four photographs of the same object from four angles.
 */
export type ProductMediaRole = 'battery' | 'size' | 'electrical' | 'listing' | 'other';

export const PRODUCT_STATUSES: ProductStatus[] = ['draft', 'published', 'archived'];
export const PRODUCT_MEDIA_ROLES: ProductMediaRole[] = [
  'battery',
  'size',
  'electrical',
  'listing',
  'other',
];

export interface Manufacturer {
  id: number;
  key: string;
  name: string;
  legalName: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  countryOfOrigin: string | null;
}

export interface Seller {
  id: number;
  key: string;
  name: string;
  address: string | null;
  customerCarePhone: string | null;
  customerCareEmail: string | null;
  gstin: string | null;
  grievanceOfficerName: string | null;
  grievanceOfficerPhone: string | null;
  packedBy: string | null;
}

export interface ProductMediaRecord {
  id: number;
  storagePath: string;
  /** Derived from SUPABASE_URL + bucket + storagePath; never stored. */
  url: string;
  altText: string;
  role: ProductMediaRole;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  position: number;
  isPrimary: boolean;
}

export interface ProductVariantRecord {
  id: number;
  variantKey: string;
  sku: string;
  title: string;
  optionValues: Record<string, string>;
  /**
   * Null until commercial terms exist. A product with an unpriced variant is
   * storable and is not publishable — see `canPublish` in `state-machine.ts`.
   */
  mrp: Paise | null;
  selling: Paise | null;
  /**
   * Two fields rather than one because "we do not track a number for this" and
   * "there are zero of these" are different statements. Only the second may
   * ever print "Sold out".
   */
  stock: number | null;
  availability: Availability | null;
  position: number;
}

export interface ProductRecord {
  id: number;
  productKey: string;
  slug: string;
  status: ProductStatus;

  brand: string | null;
  title: string;
  subtitle: string;
  modelName: string | null;
  genericName: string | null;
  productType: string | null;
  netQuantity: string | null;

  category: CategorySlug;
  subcategory: string;
  art: ProductArtKind;

  description: string[];
  highlights: string[];
  boxContents: string[];
  careInstructions: string[] | null;

  countryOfOrigin: string | null;

  warrantyMonths: number | null;
  warrantyCycles: number | null;
  warrantyText: string | null;
  installationIncluded: boolean;
  returnWindowDays: number | null;
  /**
   * Whether this product is advertised with no-cost EMI.
   *
   * Not optional and not nullable: a product either carries the offer or it
   * does not, and there is no third "unknown" state worth modelling. It
   * defaults to false in the database and the importer never writes it.
   */
  emiEnabled: boolean;

  manufacturer: Manufacturer | null;
  seller: Seller | null;

  hsnCode: string | null;
  taxRate: number | null;

  facets: ProductFacetValues;
  badges: BadgeKind[];

  launchedAt: string | null;
  popularityRank: number | null;

  seoTitle: string | null;
  seoDescription: string | null;

  /** Reference to an upstream Hostinger product. Never a content source. */
  hostingerProductId: string | null;

  variants: ProductVariantRecord[];
  media: ProductMediaRecord[];
  specGroups: SpecGroup[];
  faqs: ProductFaq[];
  sections: ProductSection[];

  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

/** The compact row the admin list renders — no children loaded. */
export interface ProductListRow {
  id: number;
  productKey: string;
  slug: string;
  status: ProductStatus;
  title: string;
  brand: string | null;
  modelName: string | null;
  category: CategorySlug;
  subcategory: string;
  /** Cheapest selling price across variants, or null when none is priced. */
  fromPrice: Paise | null;
  /**
   * Units in stock on the **primary** variant (lowest `position`) — the one the
   * product page opens on. `null` means stock is not tracked, which is a
   * different statement from `0`. Not a total across variants: no rule for
   * combining them has been agreed.
   */
  primaryStock: number | null;
  variantCount: number;
  mediaCount: number;
  updatedAt: string;
  updatedBy: string | null;
}

/* ------------------------------------------------------------- write inputs */

export interface CreateProductInput {
  productKey: string;
  slug: string;
  title: string;
  subtitle?: string;
  brand?: string | null;
  modelName?: string | null;
  category: CategorySlug;
  subcategory: string;
  art?: ProductArtKind;
}

/**
 * A patch, not a replacement.
 *
 * Every field is optional and `undefined` means "leave alone", which is what
 * lets the admin form be a set of independent tabs rather than one 40-field
 * submit that has to round-trip everything it is not editing. `null` is a real
 * value and clears the column.
 */
export interface UpdateProductInput {
  slug?: string;
  title?: string;
  subtitle?: string;
  brand?: string | null;
  modelName?: string | null;
  genericName?: string | null;
  productType?: string | null;
  netQuantity?: string | null;
  category?: CategorySlug;
  subcategory?: string;
  art?: ProductArtKind;
  description?: string[];
  highlights?: string[];
  boxContents?: string[];
  careInstructions?: string[] | null;
  countryOfOrigin?: string | null;
  warrantyMonths?: number | null;
  warrantyCycles?: number | null;
  warrantyText?: string | null;
  installationIncluded?: boolean;
  returnWindowDays?: number | null;
  emiEnabled?: boolean;
  manufacturerId?: number | null;
  sellerId?: number | null;
  hsnCode?: string | null;
  taxRate?: number | null;
  facets?: ProductFacetValues;
  badges?: BadgeKind[];
  launchedAt?: string | null;
  popularityRank?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  hostingerProductId?: string | null;
}

export interface VariantInput {
  variantKey: string;
  sku: string;
  title?: string;
  optionValues?: Record<string, string>;
  mrp: Paise | null;
  selling: Paise | null;
  stock: number | null;
  availability: Availability | null;
}

export interface MediaInput {
  storagePath: string;
  altText?: string;
  role?: ProductMediaRole;
  mime?: string | null;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
  isPrimary?: boolean;
}

export interface ManufacturerInput {
  key: string;
  name: string;
  legalName?: string | null;
  address?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  countryOfOrigin?: string | null;
}

export interface SellerInput {
  key: string;
  name: string;
  address?: string | null;
  customerCarePhone?: string | null;
  customerCareEmail?: string | null;
  gstin?: string | null;
  grievanceOfficerName?: string | null;
  grievanceOfficerPhone?: string | null;
  packedBy?: string | null;
}

export interface ProductListFilters {
  search?: string;
  status?: ProductStatus;
  category?: CategorySlug;
  limit: number;
  offset: number;
}

/* ------------------------------------------------------------------ results */

/**
 * Expected outcomes are values, not exceptions — the same convention
 * `place-order.ts` uses. A duplicate slug is a thing an administrator does, not
 * a bug, and the form needs to say which field collided.
 */
export type ProductWriteResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: 'not_found' }
  | { ok: false; code: 'duplicate'; field: 'slug' | 'product_key' | 'sku'; value: string }
  | { ok: false; code: 'invalid_transition'; from: ProductStatus; to: ProductStatus }
  | { ok: false; code: 'incomplete'; missing: string[] };
