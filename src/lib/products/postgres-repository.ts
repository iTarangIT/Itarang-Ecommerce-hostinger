import type { PoolClient } from 'pg';
import { query, queryOne, transaction } from '@/lib/db/pool';
import type {
  Availability,
  BadgeKind,
  CategorySlug,
  ProductArtKind,
  ProductFacetValues,
  ProductFaq,
  ProductSection,
  SpecGroup,
} from '@/lib/commerce/types';
import { publicUrl } from './media';
import { canTransitionProduct, publishBlockers } from './state-machine';
import type { ProductRepository } from './repository';
import type {
  CreateProductInput,
  Manufacturer,
  ManufacturerInput,
  MediaInput,
  ProductListFilters,
  ProductListRow,
  ProductMediaRecord,
  ProductMediaRole,
  ProductRecord,
  ProductStatus,
  ProductVariantRecord,
  ProductWriteResult,
  Seller,
  SellerInput,
  UpdateProductInput,
  VariantInput,
} from './types';

/**
 * PostgreSQL implementation of `ProductRepository`.
 *
 * Two things are worth reading closely before changing anything here.
 *
 * 1. **A product is loaded as an aggregate, in one round of queries, never per
 *    row.** `hydrate()` takes the product rows it was given and fetches every
 *    child collection with a single `= ANY($1)` per table. The storefront
 *    snapshot is one call to `listPublished()`, so a catalogue of any plausible
 *    size costs eight queries, not eight per product.
 *
 * 2. **Every child collection is replaced wholesale, inside a transaction, and
 *    the parent's `updated_at` is bumped in the same transaction.** The
 *    trigger on `products` only fires for updates to `products` itself, so
 *    editing a spec table would otherwise leave the product looking untouched
 *    in the admin list — and the storefront snapshot keys its cache off exactly
 *    that.
 */

/* -------------------------------------------------------------- row types */

interface ProductRow {
  id: number;
  product_key: string;
  slug: string;
  status: ProductStatus;
  brand: string | null;
  title: string;
  subtitle: string;
  model_name: string | null;
  generic_name: string | null;
  product_type: string | null;
  net_quantity: string | null;
  category: CategorySlug;
  subcategory: string;
  art: ProductArtKind;
  description: string[] | null;
  highlights: string[] | null;
  box_contents: string[] | null;
  care_instructions: string[] | null;
  country_of_origin: string | null;
  warranty_months: number | null;
  warranty_cycles: number | null;
  warranty_text: string | null;
  installation_included: boolean;
  return_window_days: number | null;
  emi_enabled: boolean;
  manufacturer_id: number | null;
  seller_id: number | null;
  hsn_code: string | null;
  tax_rate: number | null;
  facets: ProductFacetValues | null;
  badges: BadgeKind[] | null;
  launched_at: string | null;
  popularity_rank: number | null;
  seo_title: string | null;
  seo_description: string | null;
  hostinger_product_id: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  archived_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
}

interface VariantRow {
  id: number;
  product_id: number;
  variant_key: string;
  sku: string;
  title: string;
  option_values: Record<string, string> | null;
  mrp: number | null;
  selling: number | null;
  stock: number | null;
  availability: Availability | null;
  position: number;
}

interface MediaRow {
  id: number;
  product_id: number;
  storage_path: string;
  alt_text: string;
  role: ProductMediaRole;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  position: number;
  is_primary: boolean;
}

interface SpecGroupRow {
  id: number;
  product_id: number;
  title: string;
  position: number;
}

interface SpecRow {
  group_id: number;
  label: string;
  value: string;
  position: number;
}

interface FaqRow {
  product_id: number;
  question: string;
  answer: string;
  position: number;
}

interface SectionRow {
  product_id: number;
  kind: ProductSection['kind'];
  payload: Record<string, unknown>;
  position: number;
}

interface ManufacturerRow {
  id: number;
  key: string;
  name: string;
  legal_name: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  country_of_origin: string | null;
}

interface SellerRow {
  id: number;
  key: string;
  name: string;
  address: string | null;
  customer_care_phone: string | null;
  customer_care_email: string | null;
  gstin: string | null;
  grievance_officer_name: string | null;
  grievance_officer_phone: string | null;
  packed_by: string | null;
}

interface IdRow {
  id: number;
}

interface CountRow {
  total: number;
}

/* ---------------------------------------------------------------- columns */

const PRODUCT_COLUMNS = `
  id, product_key, slug, status, brand, title, subtitle, model_name, generic_name,
  product_type, net_quantity, category, subcategory, art, description, highlights,
  box_contents, care_instructions, country_of_origin, warranty_months, warranty_cycles,
  warranty_text, installation_included, return_window_days, emi_enabled,
  manufacturer_id, seller_id,
  hsn_code, tax_rate, facets, badges,
  to_char(launched_at, 'YYYY-MM-DD') AS launched_at,
  popularity_rank, seo_title, seo_description, hostinger_product_id,
  created_at, updated_at, published_at, archived_at, created_by, updated_by
`;

/* ---------------------------------------------------------------- helpers */

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Which unique constraint a 23505 violated.
 *
 * The admin form needs to say "that slug is taken", not "database error", and
 * the only way to know which of three unique columns collided is the
 * constraint name Postgres reports.
 */
function duplicateField(error: unknown): 'slug' | 'product_key' | 'sku' | null {
  if (typeof error !== 'object' || error === null) return null;
  const candidate = error as { code?: string; constraint?: string };
  if (candidate.code !== '23505') return null;
  if (candidate.constraint?.includes('slug')) return 'slug';
  if (candidate.constraint?.includes('product_key')) return 'product_key';
  if (candidate.constraint?.includes('sku')) return 'sku';
  return null;
}

function toManufacturer(row: ManufacturerRow): Manufacturer {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    legalName: row.legal_name,
    address: row.address,
    website: row.website,
    email: row.email,
    phone: row.phone,
    countryOfOrigin: row.country_of_origin,
  };
}

function toSeller(row: SellerRow): Seller {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    address: row.address,
    customerCarePhone: row.customer_care_phone,
    customerCareEmail: row.customer_care_email,
    gstin: row.gstin,
    grievanceOfficerName: row.grievance_officer_name,
    grievanceOfficerPhone: row.grievance_officer_phone,
    packedBy: row.packed_by,
  };
}

function toVariant(row: VariantRow): ProductVariantRecord {
  return {
    id: row.id,
    variantKey: row.variant_key,
    sku: row.sku,
    title: row.title,
    optionValues: row.option_values ?? {},
    mrp: row.mrp,
    selling: row.selling,
    stock: row.stock,
    availability: row.availability,
    position: row.position,
  };
}

function toMedia(row: MediaRow): ProductMediaRecord {
  return {
    id: row.id,
    storagePath: row.storage_path,
    url: publicUrl(row.storage_path),
    altText: row.alt_text,
    role: row.role,
    mime: row.mime,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    position: row.position,
    isPrimary: row.is_primary,
  };
}

/**
 * A section row becomes its discriminated-union member.
 *
 * The payload was validated by zod on the way in, so this trusts the shape but
 * still routes by `kind` rather than spreading blindly — a row whose kind the
 * application no longer knows about is dropped instead of reaching a renderer
 * that cannot draw it.
 */
function toSection(row: SectionRow): ProductSection | null {
  const payload = row.payload as Record<string, never>;
  switch (row.kind) {
    case 'applications':
      return { kind: 'applications', items: (payload.items ?? []) as never };
    case 'charging':
    case 'discharge':
      return {
        kind: row.kind,
        summary: (payload.summary ?? '') as unknown as string,
        points: (payload.points ?? []) as never,
      };
    case 'runtime':
      return {
        kind: 'runtime',
        summary: (payload.summary ?? '') as unknown as string,
        scenarios: (payload.scenarios ?? []) as never,
      };
    case 'compatibility':
    case 'care':
      return { kind: row.kind, items: (payload.items ?? []) as never };
    default:
      return null;
  }
}

/**
 * Which `UpdateProductInput` keys map to which column, and which of those need
 * a jsonb cast.
 *
 * Module level rather than local so `updateProduct` and
 * `applyProductPatchWithin` cannot disagree about what is writable — a patch
 * key missing from one of two copies would be silently ignored on that path.
 */
const PRODUCT_PATCH_COLUMNS: Record<keyof UpdateProductInput, string> = {
  slug: 'slug',
  title: 'title',
  subtitle: 'subtitle',
  brand: 'brand',
  modelName: 'model_name',
  genericName: 'generic_name',
  productType: 'product_type',
  netQuantity: 'net_quantity',
  category: 'category',
  subcategory: 'subcategory',
  art: 'art',
  description: 'description',
  highlights: 'highlights',
  boxContents: 'box_contents',
  careInstructions: 'care_instructions',
  countryOfOrigin: 'country_of_origin',
  warrantyMonths: 'warranty_months',
  warrantyCycles: 'warranty_cycles',
  warrantyText: 'warranty_text',
  installationIncluded: 'installation_included',
  returnWindowDays: 'return_window_days',
  emiEnabled: 'emi_enabled',
  manufacturerId: 'manufacturer_id',
  sellerId: 'seller_id',
  hsnCode: 'hsn_code',
  taxRate: 'tax_rate',
  facets: 'facets',
  badges: 'badges',
  launchedAt: 'launched_at',
  popularityRank: 'popularity_rank',
  seoTitle: 'seo_title',
  seoDescription: 'seo_description',
  hostingerProductId: 'hostinger_product_id',
};

// jsonb columns need the value handed over as JSON text and cast, or `pg`
// sends a Postgres array literal for a JS array and the insert fails.
const JSON_PATCH_COLUMNS = new Set([
  'description',
  'highlights',
  'box_contents',
  'care_instructions',
  'facets',
  'badges',
]);

/* ------------------------------------------------------------- repository */

class PostgresProductRepository implements ProductRepository {
  /* ----------------------------------------------------------- hydration */

  /**
   * Attach every child collection to a set of product rows.
   *
   * One query per child table for the whole batch. The alternative — a query
   * per product — turns loading the catalogue into N×8 round trips against a
   * pooled remote database, which is the difference between a fast page and a
   * slow one.
   */
  private async hydrate(rows: ProductRow[]): Promise<ProductRecord[]> {
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.id);

    const [variants, media, specGroups, faqs, sections] = await Promise.all([
      query<VariantRow>(
        `SELECT id, product_id, variant_key, sku, title, option_values, mrp, selling,
                stock, availability, position
           FROM product_variants
          WHERE product_id = ANY($1::bigint[])
          ORDER BY product_id, position, id`,
        [ids],
      ),
      query<MediaRow>(
        `SELECT id, product_id, storage_path, alt_text, role, mime, bytes, width, height,
                position, is_primary
           FROM product_media
          WHERE product_id = ANY($1::bigint[])
          ORDER BY product_id, position, id`,
        [ids],
      ),
      query<SpecGroupRow>(
        `SELECT id, product_id, title, position
           FROM product_spec_groups
          WHERE product_id = ANY($1::bigint[])
          ORDER BY product_id, position, id`,
        [ids],
      ),
      query<FaqRow>(
        `SELECT product_id, question, answer, position
           FROM product_faqs
          WHERE product_id = ANY($1::bigint[])
          ORDER BY product_id, position, id`,
        [ids],
      ),
      query<SectionRow>(
        `SELECT product_id, kind, payload, position
           FROM product_sections
          WHERE product_id = ANY($1::bigint[])
          ORDER BY product_id, position, id`,
        [ids],
      ),
    ]);

    // Specs hang off groups, not products, so they need the group ids the
    // previous query just produced.
    const groupIds = specGroups.map((group) => group.id);
    const specs = groupIds.length
      ? await query<SpecRow>(
          `SELECT group_id, label, value, position
             FROM product_specs
            WHERE group_id = ANY($1::bigint[])
            ORDER BY group_id, position, id`,
          [groupIds],
        )
      : [];

    const parties = await this.partiesFor(rows);

    const specsByGroup = new Map<number, Array<{ label: string; value: string }>>();
    for (const spec of specs) {
      const list = specsByGroup.get(spec.group_id) ?? [];
      list.push({ label: spec.label, value: spec.value });
      specsByGroup.set(spec.group_id, list);
    }

    const groupsByProduct = new Map<number, SpecGroup[]>();
    for (const group of specGroups) {
      const list = groupsByProduct.get(group.product_id) ?? [];
      list.push({ title: group.title, specs: specsByGroup.get(group.id) ?? [] });
      groupsByProduct.set(group.product_id, list);
    }

    const variantsByProduct = new Map<number, ProductVariantRecord[]>();
    for (const row of variants) {
      const list = variantsByProduct.get(row.product_id) ?? [];
      list.push(toVariant(row));
      variantsByProduct.set(row.product_id, list);
    }

    const mediaByProduct = new Map<number, ProductMediaRecord[]>();
    for (const row of media) {
      const list = mediaByProduct.get(row.product_id) ?? [];
      list.push(toMedia(row));
      mediaByProduct.set(row.product_id, list);
    }

    const faqsByProduct = new Map<number, ProductFaq[]>();
    for (const row of faqs) {
      const list = faqsByProduct.get(row.product_id) ?? [];
      list.push({ question: row.question, answer: row.answer });
      faqsByProduct.set(row.product_id, list);
    }

    const sectionsByProduct = new Map<number, ProductSection[]>();
    for (const row of sections) {
      const section = toSection(row);
      if (!section) continue;
      const list = sectionsByProduct.get(row.product_id) ?? [];
      list.push(section);
      sectionsByProduct.set(row.product_id, list);
    }

    return rows.map((row) => ({
      id: row.id,
      productKey: row.product_key,
      slug: row.slug,
      status: row.status,
      brand: row.brand,
      title: row.title,
      subtitle: row.subtitle,
      modelName: row.model_name,
      genericName: row.generic_name,
      productType: row.product_type,
      netQuantity: row.net_quantity,
      category: row.category,
      subcategory: row.subcategory,
      art: row.art,
      description: row.description ?? [],
      highlights: row.highlights ?? [],
      boxContents: row.box_contents ?? [],
      careInstructions: row.care_instructions,
      countryOfOrigin: row.country_of_origin,
      warrantyMonths: row.warranty_months,
      warrantyCycles: row.warranty_cycles,
      warrantyText: row.warranty_text,
      installationIncluded: row.installation_included,
      returnWindowDays: row.return_window_days,
      emiEnabled: row.emi_enabled,
      manufacturer: row.manufacturer_id
        ? (parties.manufacturers.get(row.manufacturer_id) ?? null)
        : null,
      seller: row.seller_id ? (parties.sellers.get(row.seller_id) ?? null) : null,
      hsnCode: row.hsn_code,
      taxRate: row.tax_rate,
      facets: row.facets ?? {},
      badges: row.badges ?? [],
      launchedAt: row.launched_at,
      popularityRank: row.popularity_rank,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      hostingerProductId: row.hostinger_product_id,
      variants: variantsByProduct.get(row.id) ?? [],
      media: mediaByProduct.get(row.id) ?? [],
      specGroups: groupsByProduct.get(row.id) ?? [],
      faqs: faqsByProduct.get(row.id) ?? [],
      sections: sectionsByProduct.get(row.id) ?? [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      publishedAt: iso(row.published_at),
      archivedAt: iso(row.archived_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    }));
  }

  /**
   * Manufacturers and sellers for a batch.
   *
   * Loaded by id rather than joined, because both tables are tiny, shared by
   * every product, and joining would repeat the same company's address once per
   * product row across the wire.
   */
  private async partiesFor(rows: ProductRow[]): Promise<{
    manufacturers: Map<number, Manufacturer>;
    sellers: Map<number, Seller>;
  }> {
    const manufacturerIds = [
      ...new Set(rows.map((row) => row.manufacturer_id).filter((id): id is number => id !== null)),
    ];
    const sellerIds = [
      ...new Set(rows.map((row) => row.seller_id).filter((id): id is number => id !== null)),
    ];

    const [manufacturerRows, sellerRows] = await Promise.all([
      manufacturerIds.length
        ? query<ManufacturerRow>(
            `SELECT id, key, name, legal_name, address, website, email, phone, country_of_origin
               FROM manufacturers WHERE id = ANY($1::bigint[])`,
            [manufacturerIds],
          )
        : Promise.resolve([]),
      sellerIds.length
        ? query<SellerRow>(
            `SELECT id, key, name, address, customer_care_phone, customer_care_email, gstin,
                    grievance_officer_name, grievance_officer_phone, packed_by
               FROM sellers WHERE id = ANY($1::bigint[])`,
            [sellerIds],
          )
        : Promise.resolve([]),
    ]);

    return {
      manufacturers: new Map(manufacturerRows.map((row) => [row.id, toManufacturer(row)])),
      sellers: new Map(sellerRows.map((row) => [row.id, toSeller(row)])),
    };
  }

  /* ---------------------------------------------------------------- reads */

  async listPublished(): Promise<ProductRecord[]> {
    const rows = await query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS}
         FROM products
        WHERE status = 'published'
        ORDER BY popularity_rank NULLS LAST, title`,
    );
    return this.hydrate(rows);
  }

  async findByKey(productKey: string): Promise<ProductRecord | null> {
    const rows = await query<ProductRow>(
      `SELECT ${PRODUCT_COLUMNS} FROM products WHERE product_key = $1`,
      [productKey],
    );
    const hydrated = await this.hydrate(rows);
    return hydrated[0] ?? null;
  }

  async findBySlug(slug: string): Promise<ProductRecord | null> {
    const rows = await query<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE slug = $1`, [
      slug,
    ]);
    const hydrated = await this.hydrate(rows);
    return hydrated[0] ?? null;
  }

  async listForAdmin(
    filters: ProductListFilters,
  ): Promise<{ items: ProductListRow[]; total: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      params.push(filters.status);
      clauses.push(`p.status = $${params.length}`);
    }
    if (filters.category) {
      params.push(filters.category);
      clauses.push(`p.category = $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      const index = params.length;
      clauses.push(
        `(lower(p.title) LIKE $${index} OR lower(p.slug) LIKE $${index}
          OR lower(coalesce(p.model_name, '')) LIKE $${index}
          OR lower(coalesce(p.brand, '')) LIKE $${index})`,
      );
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const totalRow = await queryOne<CountRow>(
      `SELECT count(*)::int AS total FROM products p ${where}`,
      params,
    );

    params.push(filters.limit, filters.offset);

    const items = await query<
      ProductListRow & {
        product_key: string;
        model_name: string | null;
        from_price: number | null;
        primary_stock: number | null;
        variant_count: number;
        media_count: number;
        updated_at: Date;
        updated_by: string | null;
      }
    >(
      `SELECT p.id, p.product_key, p.slug, p.status, p.title, p.brand, p.model_name,
              p.category, p.subcategory, p.updated_at, p.updated_by,
              (SELECT min(v.selling) FROM product_variants v WHERE v.product_id = p.id)::bigint
                AS from_price,
              -- The primary variant's stock, not a sum across variants.
              -- Ordering by position then id matches hydrate() and is the same
              -- variant the product page opens on, so the console shows the
              -- number a shopper would be held to rather than a total nobody
              -- can buy. Deliberately not an aggregate: a rule for combining
              -- stock across variants is a business decision nobody has made.
              (SELECT v.stock FROM product_variants v WHERE v.product_id = p.id
                ORDER BY v.position, v.id LIMIT 1)::int
                AS primary_stock,
              (SELECT count(*) FROM product_variants v WHERE v.product_id = p.id)::int
                AS variant_count,
              (SELECT count(*) FROM product_media m WHERE m.product_id = p.id)::int
                AS media_count
         FROM products p
         ${where}
        ORDER BY p.updated_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return {
      total: totalRow?.total ?? 0,
      items: items.map((row) => ({
        id: row.id,
        productKey: row.product_key,
        slug: row.slug,
        status: row.status,
        title: row.title,
        brand: row.brand,
        modelName: row.model_name,
        category: row.category,
        subcategory: row.subcategory,
        fromPrice: row.from_price,
        primaryStock: row.primary_stock,
        variantCount: row.variant_count,
        mediaCount: row.media_count,
        updatedAt: row.updated_at.toISOString(),
        updatedBy: row.updated_by,
      })),
    };
  }

  async listManufacturers(): Promise<Manufacturer[]> {
    const rows = await query<ManufacturerRow>(
      `SELECT id, key, name, legal_name, address, website, email, phone, country_of_origin
         FROM manufacturers ORDER BY name`,
    );
    return rows.map(toManufacturer);
  }

  async listSellers(): Promise<Seller[]> {
    const rows = await query<SellerRow>(
      `SELECT id, key, name, address, customer_care_phone, customer_care_email, gstin,
              grievance_officer_name, grievance_officer_phone, packed_by
         FROM sellers ORDER BY name`,
    );
    return rows.map(toSeller);
  }

  /* --------------------------------------------------------------- writes */

  async createProduct(
    input: CreateProductInput,
    actor: string,
  ): Promise<ProductWriteResult<string>> {
    try {
      const row = await queryOne<IdRow>(
        `INSERT INTO products
           (product_key, slug, title, subtitle, brand, model_name, category, subcategory, art,
            created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         RETURNING id`,
        [
          input.productKey,
          input.slug,
          input.title,
          input.subtitle ?? '',
          input.brand ?? null,
          input.modelName ?? null,
          input.category,
          input.subcategory,
          input.art ?? 'battery',
          actor,
        ],
      );
      if (!row) return { ok: false, code: 'not_found' };
      return { ok: true, value: input.productKey };
    } catch (error) {
      const field = duplicateField(error);
      if (field) {
        return {
          ok: false,
          code: 'duplicate',
          field,
          value: field === 'slug' ? input.slug : input.productKey,
        };
      }
      throw error;
    }
  }

  /**
   * Apply a patch.
   *
   * The column list is built from the keys actually present, so `undefined`
   * genuinely means "leave alone" and a tab that edits four fields writes four
   * fields. Spreading a whole record instead would let one tab silently revert
   * another tab's work whenever two admins had the page open.
   */
  async updateProduct(
    productKey: string,
    patch: UpdateProductInput,
    actor: string,
  ): Promise<ProductWriteResult> {
    /* column maps are module-level: PRODUCT_PATCH_COLUMNS / JSON_PATCH_COLUMNS */

    const assignments: string[] = [];
    const params: unknown[] = [];

    for (const [key, column] of Object.entries(PRODUCT_PATCH_COLUMNS) as Array<
      [keyof UpdateProductInput, string]
    >) {
      const value = patch[key];
      if (value === undefined) continue;
      if (JSON_PATCH_COLUMNS.has(column)) {
        params.push(value === null ? null : JSON.stringify(value));
        assignments.push(`${column} = $${params.length}::jsonb`);
      } else {
        params.push(value);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    params.push(actor);
    assignments.push(`updated_by = $${params.length}`);

    params.push(productKey);

    try {
      const row = await queryOne<IdRow>(
        `UPDATE products SET ${assignments.join(', ')}
          WHERE product_key = $${params.length}
        RETURNING id`,
        params,
      );
      return row ? { ok: true, value: undefined } : { ok: false, code: 'not_found' };
    } catch (error) {
      const field = duplicateField(error);
      if (field) {
        return { ok: false, code: 'duplicate', field, value: patch.slug ?? productKey };
      }
      throw error;
    }
  }

  /**
   * The same patch, applied by id inside a caller's transaction.
   *
   * Shares `PRODUCT_PATCH_COLUMNS` and `JSON_PATCH_COLUMNS` with
   * `updateProduct` so the two cannot drift over which columns are writable or
   * which need a jsonb cast.
   */
  private async applyProductPatchWithin(
    client: PoolClient,
    id: number,
    patch: UpdateProductInput,
    actor: string,
  ): Promise<void> {
    const assignments: string[] = [];
    const params: unknown[] = [];

    for (const [key, column] of Object.entries(PRODUCT_PATCH_COLUMNS) as Array<
      [keyof UpdateProductInput, string]
    >) {
      const value = patch[key];
      if (value === undefined) continue;
      if (JSON_PATCH_COLUMNS.has(column)) {
        params.push(value === null ? null : JSON.stringify(value));
        assignments.push(`${column} = $${params.length}::jsonb`);
      } else {
        params.push(value);
        assignments.push(`${column} = $${params.length}`);
      }
    }

    params.push(actor);
    assignments.push(`updated_by = $${params.length}`);
    params.push(id);

    await client.query(
      `UPDATE products SET ${assignments.join(', ')} WHERE id = $${params.length}`,
      params,
    );
  }

  /** Delete-and-reinsert, inside a caller's transaction. */
  private async replaceVariantsWithin(
    client: PoolClient,
    id: number,
    variants: VariantInput[],
  ): Promise<void> {
    await client.query('DELETE FROM product_variants WHERE product_id = $1', [id]);

    for (const [index, variant] of variants.entries()) {
      await client.query(
        `INSERT INTO product_variants
           (product_id, variant_key, sku, title, option_values, mrp, selling, stock,
            availability, position)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
        [
          id,
          variant.variantKey,
          variant.sku,
          variant.title ?? '',
          JSON.stringify(variant.optionValues ?? {}),
          variant.mrp,
          variant.selling,
          variant.stock,
          variant.availability,
          index,
        ],
      );
    }
  }

  async setStatus(
    productKey: string,
    to: ProductStatus,
    actor: string,
  ): Promise<ProductWriteResult> {
    const product = await this.findByKey(productKey);
    if (!product) return { ok: false, code: 'not_found' };

    if (product.status === to) return { ok: true, value: undefined };

    if (!canTransitionProduct(product.status, to)) {
      return { ok: false, code: 'invalid_transition', from: product.status, to };
    }

    // The gate, applied on the server rather than by hiding a button. A form
    // post claiming `to=published` on a product with no price must fail here.
    if (to === 'published') {
      const missing = publishBlockers(product);
      if (missing.length > 0) return { ok: false, code: 'incomplete', missing };
    }

    await query(
      `UPDATE products
          SET status = $2,
              updated_by = $3,
              published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
              archived_at  = CASE WHEN $2 = 'archived'  THEN now() ELSE NULL END
        WHERE product_key = $1`,
      [productKey, to, actor],
    );

    return { ok: true, value: undefined };
  }

  /** Resolve a product key to its id inside an open transaction, or null. */
  private async idWithin(client: PoolClient, productKey: string): Promise<number | null> {
    const result = await client.query<IdRow>('SELECT id FROM products WHERE product_key = $1', [
      productKey,
    ]);
    return result.rows[0]?.id ?? null;
  }

  /** Bump the parent so the admin list and the snapshot cache both notice. */
  private async touchWithin(client: PoolClient, id: number, actor: string): Promise<void> {
    await client.query('UPDATE products SET updated_by = $2 WHERE id = $1', [id, actor]);
  }

  /**
   * Tax fields and variants, committed together.
   *
   * The pricing form writes both, and it used to do so as two independent
   * calls: `updateProduct` for HSN, GST and the EMI flag, then
   * `replaceVariants` for prices and stock. The first could commit while the
   * second failed on a duplicate SKU, leaving a product taxed at the new rate
   * and priced at the old one — with the form reporting an error, so nobody
   * knew half of it had landed.
   *
   * `replaceVariants` deletes before inserting, which makes the window worse
   * than a partial update: a failure between the two calls could leave a
   * product with no variants at all.
   */
  async updatePricing(
    productKey: string,
    patch: UpdateProductInput,
    variants: VariantInput[],
    actor: string,
  ): Promise<ProductWriteResult> {
    try {
      return await transaction(async (client) => {
        const id = await this.idWithin(client, productKey);
        if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

        await this.applyProductPatchWithin(client, id, patch, actor);
        await this.replaceVariantsWithin(client, id, variants);

        return { ok: true, value: undefined } as ProductWriteResult;
      });
    } catch (error) {
      const field = duplicateField(error);
      if (field === 'sku') {
        const sku = variants.find((variant) => variant.sku)?.sku ?? '';
        return { ok: false, code: 'duplicate', field: 'sku', value: sku };
      }
      if (field) return { ok: false, code: 'duplicate', field, value: productKey };
      throw error;
    }
  }

  async replaceVariants(
    productKey: string,
    variants: VariantInput[],
    actor: string,
  ): Promise<ProductWriteResult> {
    try {
      return await transaction(async (client) => {
        const id = await this.idWithin(client, productKey);
        if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

        await client.query('DELETE FROM product_variants WHERE product_id = $1', [id]);

        for (const [index, variant] of variants.entries()) {
          await client.query(
            `INSERT INTO product_variants
               (product_id, variant_key, sku, title, option_values, mrp, selling, stock,
                availability, position)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
            [
              id,
              variant.variantKey,
              variant.sku,
              variant.title ?? '',
              JSON.stringify(variant.optionValues ?? {}),
              variant.mrp,
              variant.selling,
              variant.stock,
              variant.availability,
              index,
            ],
          );
        }

        await this.touchWithin(client, id, actor);
        return { ok: true, value: undefined } as ProductWriteResult;
      });
    } catch (error) {
      const field = duplicateField(error);
      if (field === 'sku') {
        const sku = variants.find((variant) => variant.sku)?.sku ?? '';
        return { ok: false, code: 'duplicate', field: 'sku', value: sku };
      }
      throw error;
    }
  }

  async replaceSpecGroups(
    productKey: string,
    groups: SpecGroup[],
    actor: string,
  ): Promise<ProductWriteResult> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

      // The specs go with the groups: product_specs cascades from
      // product_spec_groups, so one delete is enough.
      await client.query('DELETE FROM product_spec_groups WHERE product_id = $1', [id]);

      for (const [groupIndex, group] of groups.entries()) {
        const inserted = await client.query<IdRow>(
          `INSERT INTO product_spec_groups (product_id, title, position)
           VALUES ($1, $2, $3) RETURNING id`,
          [id, group.title, groupIndex],
        );
        const groupId = inserted.rows[0]?.id;
        if (!groupId) continue;

        for (const [specIndex, spec] of group.specs.entries()) {
          await client.query(
            `INSERT INTO product_specs (group_id, label, value, position)
             VALUES ($1, $2, $3, $4)`,
            [groupId, spec.label, spec.value, specIndex],
          );
        }
      }

      await this.touchWithin(client, id, actor);
      return { ok: true, value: undefined } as ProductWriteResult;
    });
  }

  async replaceFaqs(
    productKey: string,
    faqs: ProductFaq[],
    actor: string,
  ): Promise<ProductWriteResult> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

      await client.query('DELETE FROM product_faqs WHERE product_id = $1', [id]);

      for (const [index, faq] of faqs.entries()) {
        await client.query(
          `INSERT INTO product_faqs (product_id, question, answer, position)
           VALUES ($1, $2, $3, $4)`,
          [id, faq.question, faq.answer, index],
        );
      }

      await this.touchWithin(client, id, actor);
      return { ok: true, value: undefined } as ProductWriteResult;
    });
  }

  async replaceSections(
    productKey: string,
    sections: ProductSection[],
    actor: string,
  ): Promise<ProductWriteResult> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

      await client.query('DELETE FROM product_sections WHERE product_id = $1', [id]);

      for (const [index, section] of sections.entries()) {
        const { kind, ...payload } = section;
        await client.query(
          `INSERT INTO product_sections (product_id, kind, payload, position)
           VALUES ($1, $2, $3::jsonb, $4)`,
          [id, kind, JSON.stringify(payload), index],
        );
      }

      await this.touchWithin(client, id, actor);
      return { ok: true, value: undefined } as ProductWriteResult;
    });
  }

  /* ---------------------------------------------------------------- media */

  async addMedia(
    productKey: string,
    media: MediaInput,
    actor: string,
  ): Promise<ProductWriteResult<number>> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult<number>;

      const next = await client.query<{ next: number }>(
        `SELECT coalesce(max(position) + 1, 0)::int AS next
           FROM product_media WHERE product_id = $1`,
        [id],
      );
      const position = next.rows[0]?.next ?? 0;

      // The first image a product ever gets is its primary one. Without this a
      // freshly imported product would have four images and no primary, and
      // `product_media_primary_idx` only stops a *second* claim, not zero.
      const isPrimary = media.isPrimary ?? position === 0;
      if (isPrimary) {
        await client.query(
          'UPDATE product_media SET is_primary = false WHERE product_id = $1 AND is_primary',
          [id],
        );
      }

      const inserted = await client.query<IdRow>(
        `INSERT INTO product_media
           (product_id, storage_path, alt_text, role, mime, bytes, width, height,
            position, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          id,
          media.storagePath,
          media.altText ?? '',
          media.role ?? 'other',
          media.mime ?? null,
          media.bytes ?? null,
          media.width ?? null,
          media.height ?? null,
          position,
          isPrimary,
        ],
      );

      await this.touchWithin(client, id, actor);

      const mediaId = inserted.rows[0]?.id;
      return mediaId
        ? ({ ok: true, value: mediaId } as ProductWriteResult<number>)
        : ({ ok: false, code: 'not_found' } as ProductWriteResult<number>);
    });
  }

  async updateMedia(
    productKey: string,
    mediaId: number,
    patch: { altText?: string; role?: ProductMediaRole },
    actor: string,
  ): Promise<ProductWriteResult> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

      const result = await client.query(
        `UPDATE product_media
            SET alt_text = coalesce($3, alt_text),
                role     = coalesce($4, role)
          WHERE id = $2 AND product_id = $1`,
        [id, mediaId, patch.altText ?? null, patch.role ?? null],
      );
      if (result.rowCount === 0) return { ok: false, code: 'not_found' } as ProductWriteResult;

      await this.touchWithin(client, id, actor);
      return { ok: true, value: undefined } as ProductWriteResult;
    });
  }

  /**
   * Re-number the gallery.
   *
   * Positions are rewritten from the supplied order rather than swapped, so the
   * result is always a dense 0..n-1 sequence whatever the caller sent. Ids that
   * belong to another product are ignored by the `product_id` predicate rather
   * than trusted.
   */
  async reorderMedia(
    productKey: string,
    orderedIds: number[],
    actor: string,
  ): Promise<ProductWriteResult> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

      for (const [index, mediaId] of orderedIds.entries()) {
        await client.query(
          'UPDATE product_media SET position = $3 WHERE id = $2 AND product_id = $1',
          [id, mediaId, index],
        );
      }

      await this.touchWithin(client, id, actor);
      return { ok: true, value: undefined } as ProductWriteResult;
    });
  }

  async setPrimaryMedia(
    productKey: string,
    mediaId: number,
    actor: string,
  ): Promise<ProductWriteResult> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult;

      // Clear first: the partial unique index permits exactly one primary row
      // per product, so setting the new one before clearing the old would
      // violate it.
      await client.query(
        'UPDATE product_media SET is_primary = false WHERE product_id = $1 AND is_primary',
        [id],
      );
      const result = await client.query(
        'UPDATE product_media SET is_primary = true WHERE id = $2 AND product_id = $1',
        [id, mediaId],
      );
      if (result.rowCount === 0) return { ok: false, code: 'not_found' } as ProductWriteResult;

      await this.touchWithin(client, id, actor);
      return { ok: true, value: undefined } as ProductWriteResult;
    });
  }

  async deleteMedia(
    productKey: string,
    mediaId: number,
    actor: string,
  ): Promise<ProductWriteResult<string>> {
    return transaction(async (client) => {
      const id = await this.idWithin(client, productKey);
      if (!id) return { ok: false, code: 'not_found' } as ProductWriteResult<string>;

      const deleted = await client.query<{ storage_path: string; is_primary: boolean }>(
        `DELETE FROM product_media WHERE id = $2 AND product_id = $1
         RETURNING storage_path, is_primary`,
        [id, mediaId],
      );
      const row = deleted.rows[0];
      if (!row) return { ok: false, code: 'not_found' } as ProductWriteResult<string>;

      // Deleting the primary image must not leave a product without one — the
      // gallery and every card read images[0].
      if (row.is_primary) {
        await client.query(
          `UPDATE product_media SET is_primary = true
            WHERE id = (SELECT id FROM product_media WHERE product_id = $1
                         ORDER BY position, id LIMIT 1)`,
          [id],
        );
      }

      await this.touchWithin(client, id, actor);
      return { ok: true, value: row.storage_path } as ProductWriteResult<string>;
    });
  }

  /* -------------------------------------------------------------- parties */

  async upsertManufacturer(input: ManufacturerInput): Promise<Manufacturer> {
    const row = await queryOne<ManufacturerRow>(
      `INSERT INTO manufacturers
         (key, name, legal_name, address, website, email, phone, country_of_origin)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         legal_name = EXCLUDED.legal_name,
         address = EXCLUDED.address,
         website = EXCLUDED.website,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         country_of_origin = EXCLUDED.country_of_origin
       RETURNING id, key, name, legal_name, address, website, email, phone, country_of_origin`,
      [
        input.key,
        input.name,
        input.legalName ?? null,
        input.address ?? null,
        input.website ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.countryOfOrigin ?? null,
      ],
    );
    if (!row) throw new Error(`Failed to upsert manufacturer ${input.key}`);
    return toManufacturer(row);
  }

  async upsertSeller(input: SellerInput): Promise<Seller> {
    const row = await queryOne<SellerRow>(
      `INSERT INTO sellers
         (key, name, address, customer_care_phone, customer_care_email, gstin,
          grievance_officer_name, grievance_officer_phone, packed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name,
         address = EXCLUDED.address,
         customer_care_phone = EXCLUDED.customer_care_phone,
         customer_care_email = EXCLUDED.customer_care_email,
         gstin = EXCLUDED.gstin,
         grievance_officer_name = EXCLUDED.grievance_officer_name,
         grievance_officer_phone = EXCLUDED.grievance_officer_phone,
         packed_by = EXCLUDED.packed_by
       RETURNING id, key, name, address, customer_care_phone, customer_care_email, gstin,
                 grievance_officer_name, grievance_officer_phone, packed_by`,
      [
        input.key,
        input.name,
        input.address ?? null,
        input.customerCarePhone ?? null,
        input.customerCareEmail ?? null,
        input.gstin ?? null,
        input.grievanceOfficerName ?? null,
        input.grievanceOfficerPhone ?? null,
        input.packedBy ?? null,
      ],
    );
    if (!row) throw new Error(`Failed to upsert seller ${input.key}`);
    return toSeller(row);
  }
}

let instance: PostgresProductRepository | null = null;

/** The one product repository, memoised like `orders()`. */
export function productRepository(): ProductRepository {
  if (!instance) instance = new PostgresProductRepository();
  return instance;
}
