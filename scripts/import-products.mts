/**
 * Import the transcribed product catalogue.
 *
 *   node --env-file-if-exists=.env.local scripts/import-products.mts [--dry-run]
 *
 * Idempotent, and that is the whole design. Everything is addressed by a key we
 * mint — `manufacturers.key`, `sellers.key`, `products.product_key` — so a
 * second run updates the same rows rather than creating a second catalogue.
 * Child collections are replaced wholesale, because the seed file is the source
 * of truth for them and a merge would leave rows behind that nobody can see in
 * the diff.
 *
 * **What it will not do.**
 *
 * It never changes a product's `status`. A product is created in the state its
 * seed entry names, and after that publishing is a decision made in the admin
 * console — a re-import must not quietly republish something an administrator
 * withdrew, or withdraw something they published.
 *
 * It never touches media rows. Images live in Supabase Storage and are handled
 * by `upload-product-media.mts`, which knows about the archive and the bucket.
 * Running this twice cannot detach a product from its gallery.
 *
 * It never writes to `catalogue_products` / `catalogue_variants` /
 * `catalogue_skus`. Those mirror what Hostinger is serving and mean something
 * different; this catalogue is ours.
 */
import pg from 'pg';
import { connectionOptions } from '../src/lib/db/connection.ts';
import {
  MANUFACTURERS,
  SELLERS,
  TRONTEK_PRODUCTS,
} from '../db/seed/trontek-products.ts';
import type { ProductSeed } from '../src/lib/products/seed-types.ts';

const { Client } = pg;

const DRY_RUN = process.argv.includes('--dry-run');

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

/**
 * Sanity checks that run before a single statement.
 *
 * A duplicate SKU or slug would be caught by the database, but only halfway
 * through the import and with a constraint name rather than a sentence. These
 * are cheap and they name the offender.
 */
function validate(products: ProductSeed[]): void {
  const seen = new Map<string, string[]>();
  const record = (kind: string, value: string) => {
    const key = `${kind}:${value}`;
    seen.set(key, [...(seen.get(key) ?? []), value]);
  };

  for (const product of products) {
    record('product_key', product.productKey);
    record('slug', product.slug);
    for (const variant of product.variants) record('sku', variant.sku);

    if (product.variants.length === 0) {
      fail(`${product.productKey} has no variants; it would have nowhere to carry a SKU.`);
    }

    // The publish gate lives in the application, but a seed entry that claims
    // `published` and cannot be is a mistake in the file, not a runtime state.
    if (product.status === 'published') {
      const priced = product.variants.some(
        (variant) => variant.mrp !== null && variant.selling !== null,
      );
      if (!priced) {
        fail(
          `${product.productKey} is marked published but no variant has both an MRP and a ` +
            'selling price. Mark it draft, or price it.',
        );
      }
      if (product.description.length === 0) {
        fail(`${product.productKey} is marked published but has no description.`);
      }
    }
  }

  for (const [key, values] of seen) {
    if (values.length > 1) {
      const [kind] = key.split(':');
      fail(`Duplicate ${kind} in the seed data: ${values[0]}`);
    }
  }
}

async function main(): Promise<void> {
  validate(TRONTEK_PRODUCTS);
  console.log(
    `\n  ${TRONTEK_PRODUCTS.length} products, ${MANUFACTURERS.length} manufacturer(s), ` +
      `${SELLERS.length} seller(s) — validated.`,
  );

  if (DRY_RUN) {
    for (const product of TRONTEK_PRODUCTS) {
      const priced = product.variants[0]?.selling;
      console.log(
        `    ${product.status.padEnd(9)} ${product.productKey.padEnd(32)} ` +
          `${priced === null || priced === undefined ? 'no price' : `₹${(priced / 100).toLocaleString('en-IN')}`}`,
      );
    }
    console.log('\n  Dry run — nothing was written.\n');
    return;
  }

  const { connectionString, ssl, info } = connectionOptions();
  const client = new Client({ connectionString, ssl });
  await client.connect();
  console.log(`  → ${info.host}/${info.database}\n`);

  try {
    await client.query('BEGIN');

    /* ------------------------------------------------------------ parties */

    const manufacturerIds = new Map<string, number>();
    for (const manufacturer of MANUFACTURERS) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO manufacturers
           (key, name, legal_name, address, website, email, phone, country_of_origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name, legal_name = EXCLUDED.legal_name,
           address = EXCLUDED.address, website = EXCLUDED.website,
           email = EXCLUDED.email, phone = EXCLUDED.phone,
           country_of_origin = EXCLUDED.country_of_origin
         RETURNING id`,
        [
          manufacturer.key,
          manufacturer.name,
          manufacturer.legalName ?? null,
          manufacturer.address ?? null,
          manufacturer.website ?? null,
          manufacturer.email ?? null,
          manufacturer.phone ?? null,
          manufacturer.countryOfOrigin ?? null,
        ],
      );
      manufacturerIds.set(manufacturer.key, result.rows[0]!.id);
    }

    const sellerIds = new Map<string, number>();
    for (const seller of SELLERS) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO sellers
           (key, name, address, customer_care_phone, customer_care_email, gstin,
            grievance_officer_name, grievance_officer_phone, packed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (key) DO UPDATE SET
           name = EXCLUDED.name, address = EXCLUDED.address,
           customer_care_phone = EXCLUDED.customer_care_phone,
           customer_care_email = EXCLUDED.customer_care_email,
           gstin = EXCLUDED.gstin,
           grievance_officer_name = EXCLUDED.grievance_officer_name,
           grievance_officer_phone = EXCLUDED.grievance_officer_phone,
           packed_by = EXCLUDED.packed_by
         RETURNING id`,
        [
          seller.key,
          seller.name,
          seller.address ?? null,
          seller.customerCarePhone ?? null,
          seller.customerCareEmail ?? null,
          seller.gstin ?? null,
          seller.grievanceOfficerName ?? null,
          seller.grievanceOfficerPhone ?? null,
          seller.packedBy ?? null,
        ],
      );
      sellerIds.set(seller.key, result.rows[0]!.id);
    }

    /* ----------------------------------------------------------- products */

    let created = 0;
    let updated = 0;

    for (const seed of TRONTEK_PRODUCTS) {
      const manufacturerId = manufacturerIds.get(seed.manufacturerKey) ?? null;
      const sellerId = sellerIds.get(seed.sellerKey) ?? null;

      const existing = await client.query<{ id: number }>(
        'SELECT id FROM products WHERE product_key = $1',
        [seed.productKey],
      );

      // `status` is set on insert only. See the header: a re-import must not
      // republish something an administrator withdrew.
      const result = await client.query<{ id: number }>(
        `INSERT INTO products
           (product_key, slug, status, brand, title, subtitle, model_name, generic_name,
            product_type, net_quantity, category, subcategory, art, description, highlights,
            box_contents, care_instructions, country_of_origin, warranty_months, warranty_cycles,
            warranty_text, installation_included, return_window_days, manufacturer_id, seller_id,
            hsn_code, tax_rate, facets, badges, popularity_rank, created_by, updated_by,
            published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb,
                 $16::jsonb, $17::jsonb, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
                 $28::jsonb, $29::jsonb, $30, 'import', 'import',
                 CASE WHEN $3 = 'published' THEN now() ELSE NULL END)
         ON CONFLICT (product_key) DO UPDATE SET
           slug = EXCLUDED.slug, brand = EXCLUDED.brand, title = EXCLUDED.title,
           subtitle = EXCLUDED.subtitle, model_name = EXCLUDED.model_name,
           generic_name = EXCLUDED.generic_name, product_type = EXCLUDED.product_type,
           net_quantity = EXCLUDED.net_quantity, category = EXCLUDED.category,
           subcategory = EXCLUDED.subcategory, art = EXCLUDED.art,
           description = EXCLUDED.description, highlights = EXCLUDED.highlights,
           box_contents = EXCLUDED.box_contents, care_instructions = EXCLUDED.care_instructions,
           country_of_origin = EXCLUDED.country_of_origin,
           warranty_months = EXCLUDED.warranty_months,
           warranty_cycles = EXCLUDED.warranty_cycles, warranty_text = EXCLUDED.warranty_text,
           installation_included = EXCLUDED.installation_included,
           return_window_days = EXCLUDED.return_window_days,
           manufacturer_id = EXCLUDED.manufacturer_id, seller_id = EXCLUDED.seller_id,
           hsn_code = EXCLUDED.hsn_code, tax_rate = EXCLUDED.tax_rate,
           facets = EXCLUDED.facets, badges = EXCLUDED.badges,
           popularity_rank = EXCLUDED.popularity_rank, updated_by = 'import'
         RETURNING id`,
        [
          seed.productKey,
          seed.slug,
          seed.status,
          seed.brand,
          seed.title,
          seed.subtitle,
          seed.modelName,
          seed.genericName,
          seed.productType,
          seed.netQuantity,
          seed.category,
          seed.subcategory,
          seed.art,
          JSON.stringify(seed.description),
          JSON.stringify(seed.highlights),
          JSON.stringify(seed.boxContents),
          seed.careInstructions === null ? null : JSON.stringify(seed.careInstructions),
          seed.countryOfOrigin,
          seed.warrantyMonths,
          seed.warrantyCycles,
          seed.warrantyText,
          seed.installationIncluded,
          seed.returnWindowDays,
          manufacturerId,
          sellerId,
          seed.hsnCode,
          seed.taxRate,
          JSON.stringify(seed.facets),
          JSON.stringify(seed.badges),
          seed.popularityRank,
        ],
      );

      const productId = result.rows[0]!.id;
      if (existing.rowCount === 0) created += 1;
      else updated += 1;

      /* ------------------------------------------------------- variants */

      // Replaced, not merged: the seed file is the source of truth for the
      // shape of the product, and a stale variant left behind would keep its
      // SKU reserved against the unique index.
      await client.query('DELETE FROM product_variants WHERE product_id = $1', [productId]);
      for (const [index, variant] of seed.variants.entries()) {
        await client.query(
          `INSERT INTO product_variants
             (product_id, variant_key, sku, title, option_values, mrp, selling, stock,
              availability, position)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
          [
            productId,
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

      /* -------------------------------------------------- specifications */

      await client.query('DELETE FROM product_spec_groups WHERE product_id = $1', [productId]);
      for (const [groupIndex, group] of seed.specGroups.entries()) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO product_spec_groups (product_id, title, position)
           VALUES ($1, $2, $3) RETURNING id`,
          [productId, group.title, groupIndex],
        );
        const groupId = inserted.rows[0]!.id;
        for (const [specIndex, spec] of group.specs.entries()) {
          await client.query(
            `INSERT INTO product_specs (group_id, label, value, position)
             VALUES ($1, $2, $3, $4)`,
            [groupId, spec.label, spec.value, specIndex],
          );
        }
      }

      /* ------------------------------------------------------------ faqs */

      await client.query('DELETE FROM product_faqs WHERE product_id = $1', [productId]);
      for (const [index, faq] of seed.faqs.entries()) {
        await client.query(
          `INSERT INTO product_faqs (product_id, question, answer, position)
           VALUES ($1, $2, $3, $4)`,
          [productId, faq.question, faq.answer, index],
        );
      }

      /* -------------------------------------------------------- sections */

      await client.query('DELETE FROM product_sections WHERE product_id = $1', [productId]);
      for (const [index, section] of seed.sections.entries()) {
        const { kind, ...payload } = section;
        await client.query(
          `INSERT INTO product_sections (product_id, kind, payload, position)
           VALUES ($1, $2, $3::jsonb, $4)`,
          [productId, kind, JSON.stringify(payload), index],
        );
      }

      console.log(`    ${existing.rowCount === 0 ? 'created' : 'updated'}  ${seed.productKey}`);
    }

    await client.query('COMMIT');
    console.log(`\n  ✓ ${created} created, ${updated} updated.`);
    console.log('    Images are a separate step: npm run products:media\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
