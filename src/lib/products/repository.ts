import type { ProductFaq, ProductSection, SpecGroup } from '@/lib/commerce/types';
import type {
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
