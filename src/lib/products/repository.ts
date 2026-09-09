import type { ProductFaq, ProductSection, SpecGroup } from '@/lib/commerce/types';
import type {
  CataloguePriceRow,
  CreateProductInput,
  Manufacturer,
  ManufacturerInput,
  MediaInput,
  ProductListFilters,
  ProductListRow,
  ProductRecord,
  ProductStatus,
  ProductWriteResult,
  Seller,
  SellerInput,
  UpdateProductInput,
  VariantInput,
} from './types';

/**
 * The contract between the product catalogue and everything that reads or
 * writes it — the storefront provider, the admin console, the importer.
 *
 * Separated from its implementation for the same reason `OrderRepository` is:
 * the admin actions and the catalog provider can be tested against a fake
 * without a database, and the SQL stays in one file.
 *
 * The `replace*` methods take the whole collection rather than a diff. The
 * admin edits a product's specifications as a list and submits that list; a
 * patch protocol over rows nobody has a stable id for would be a worse contract
 * and a harder one to get right.
 */
export interface ProductRepository {
  /* ------------------------------------------------------------- reads */

  /** Every published product, fully hydrated. The storefront snapshot. */
  listPublished(): Promise<ProductRecord[]>;

  /** Any product by its internal key, whatever its status. Admin only. */
  findByKey(productKey: string): Promise<ProductRecord | null>;

  /** Any product by slug, whatever its status. Used to check slug collisions. */
  findBySlug(slug: string): Promise<ProductRecord | null>;

  listForAdmin(filters: ProductListFilters): Promise<{ items: ProductListRow[]; total: number }>;

  listManufacturers(): Promise<Manufacturer[]>;
  listSellers(): Promise<Seller[]>;

  /* ------------------------------------------------------------ writes */

  createProduct(input: CreateProductInput, actor: string): Promise<ProductWriteResult<string>>;
  updateProduct(
    productKey: string,
    patch: UpdateProductInput,
    actor: string,
  ): Promise<ProductWriteResult>;

  /**
   * Move a product between draft, published and archived.
   *
   * Validated against `canTransitionProduct`, and — when publishing — against
   * `publishBlockers`, so an incomplete product cannot reach the storefront
   * even if the form is tampered with.
   */
  setStatus(
    productKey: string,
    to: ProductStatus,
    actor: string,
  ): Promise<ProductWriteResult>;

  /**
   * The pricing tab: tax fields and the full variant list, in one transaction.
   *
   * Separate from `updateProduct` + `replaceVariants` because that pair could
   * commit the first and fail the second, leaving a product taxed at a new rate
   * and priced at the old one — or, since variants are delete-then-reinsert,
   * with no variants at all.
   */
  updatePricing(
    productKey: string,
    patch: UpdateProductInput,
    variants: VariantInput[],
    actor: string,
  ): Promise<ProductWriteResult>;

  replaceVariants(
    productKey: string,
    variants: VariantInput[],
    actor: string,
  ): Promise<ProductWriteResult>;

  /* ------------------------------------------------------ bulk pricing */

  /** Every SKU in the catalogue, for validating an uploaded price list. */
  listVariantSkus(): Promise<string[]>;

  /**
   * Every SKU with the prices it carries right now.
   *
   * One read serving both halves of the bulk-pricing round trip: the downloaded
   * template is filled in with these figures, and the uploaded file is
   * classified against them — which is what lets an unchanged row be recognised
   * as unchanged and skipped rather than rewritten with the value it already
   * holds.
   *
   * `mrp` and `selling` are nullable in the schema so a draft can exist before
   * its commercial terms do, and that null is carried through rather than
   * flattened to zero. A template cell for an unpriced variant is blank, which
   * is the truth; a zero would read as "free".
   */
  listVariantPrices(): Promise<CataloguePriceRow[]>;

  /**
   * Set MRP and selling price on many variants at once, keyed on SKU.
   *
   * Deliberately **not** `replaceVariants`. That deletes a product's variants
   * and reinserts them from the input, which is right for a form that submits
   * every field and catastrophic for a price list: stock, availability, option
   * values and variant titles are absent from the spreadsheet and would be
   * erased by omission. This writes two columns and touches nothing else.
   *
   * One transaction for the whole file. A price list applied halfway leaves the
   * catalogue mixing two sets of prices with no way to tell which row came from
   * where, so either all of it lands or none of it does.
   */
  updateVariantPricesBySku(
    rows: ReadonlyArray<{ sku: string; mrp: number; selling: number }>,
    actor: string,
  ): Promise<{ ok: true; updated: number } | { ok: false; code: 'not_found'; sku: string }>;
  replaceSpecGroups(
    productKey: string,
    groups: SpecGroup[],
    actor: string,
  ): Promise<ProductWriteResult>;
  replaceFaqs(productKey: string, faqs: ProductFaq[], actor: string): Promise<ProductWriteResult>;
  replaceSections(
    productKey: string,
    sections: ProductSection[],
    actor: string,
  ): Promise<ProductWriteResult>;

  /* ------------------------------------------------------------- media */

  addMedia(productKey: string, media: MediaInput, actor: string): Promise<ProductWriteResult<number>>;
  updateMedia(
    productKey: string,
    mediaId: number,
    patch: { altText?: string; role?: MediaInput['role'] },
    actor: string,
  ): Promise<ProductWriteResult>;
  /** Ids in the order they should appear. Anything omitted keeps its place at the end. */
  reorderMedia(productKey: string, orderedIds: number[], actor: string): Promise<ProductWriteResult>;
  setPrimaryMedia(productKey: string, mediaId: number, actor: string): Promise<ProductWriteResult>;
  /** Returns the storage path so the caller can remove the object it named. */
  deleteMedia(
    productKey: string,
    mediaId: number,
    actor: string,
  ): Promise<ProductWriteResult<string>>;

  /* ------------------------------------------------------------ parties */

  upsertManufacturer(input: ManufacturerInput): Promise<Manufacturer>;
  upsertSeller(input: SellerInput): Promise<Seller>;
}
