import type { PoolClient } from 'pg';
import { query, transaction } from '@/lib/db/pool';
import { unmappedProductIds } from './hostinger/enrichment';
import type { Product } from './types';

/**
 * Mirror the live catalogue into our own tables, and refuse duplicates there.
 *
 * `commerce/health.ts` already *detects* two products sharing a SKU. Detection
 * was never enough: `order_items.sku` is the snapshot an invoice is built from,
 * so by the time a banner appears the duplicate may already be in a permanent
 * financial record. And duplicate *slugs* were not detected at all —
 * `hostinger-provider.getProduct()` resolves with `.find()`, so a second
 * product carrying an existing url_handle is silently unreachable.
 *
 * This module moves the decision to a place that can actually say no: a
 * database constraint. `catalogue_skus.sku` is a primary key, so a second
 * product claiming a SKU cannot be written. `catalogue_products.slug` is
 * unique, so a colliding slug cannot be written either.
 *
 * **A sync never takes a live product off the shelf.** The catalogue already
 * contains a collision today, and withdrawing one side of it the first time
 * this code runs would remove a product from sale that nobody asked to remove.
 * So the rule is asymmetric, deliberately:
 *
 *   - a product already mirrored, and every product on the very first sync, is
 *     **grandfathered** — the collision is recorded and alerted, and it stays
 *     on sale;
 *   - a product arriving **new** into an established mirror, claiming a SKU or
 *     slug somebody already holds, is **quarantined**.
 *
 * That is the honest reading of preventing duplicate creation: stop the next
 * one, do not retroactively punish what is already selling. Resolving an
 * existing collision is a merchant decision made in hPanel, and the alert is
 * how it gets asked for.
 *
 * **The incumbent wins.** A contested SKU stays with the product that already
 * holds it. Transferring it to a newly-seen product would change the identity
 * of something that may already have orders against it.
 *
 * Nothing is ever deleted. Runs only under `COMMERCE_PROVIDER=hostinger` — the
 * mock catalogue is development data and has no business in the mirror.
 */

export type AlertKind =
  | 'duplicate_sku'
  | 'duplicate_slug'
  | 'unmapped_enrichment'
  | 'orphan_variant'
  | 'inventory_drift';

export interface Collision {
  productId: string;
  reason: AlertKind;
  subject: string;
}

export interface CatalogueSyncResult {
  productsSeen: number;
  productsActive: number;
  /** Withheld from the storefront: new arrivals that lost a uniqueness check. */
  productsQuarantined: number;
  /** Colliding, but left on sale because they were already established. */
  productsGrandfathered: number;
  variantsSeen: number;
  quarantined: Collision[];
  grandfathered: Collision[];
  alertsRaised: number;
}

/**
 * Record a problem, or refresh one already recorded.
 *
 * `UNIQUE (kind, subject)` means re-observing the same collision on the next
 * sync touches `last_seen_at` instead of growing the table. A previously
 * resolved alert that recurs is deliberately re-opened — the problem came back,
 * so the acknowledgement is stale.
 */
async function raiseAlert(
  client: PoolClient,
  kind: AlertKind,
  subject: string,
  detail: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO catalogue_alerts (kind, subject, detail)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (kind, subject) DO UPDATE
       SET detail       = EXCLUDED.detail,
           last_seen_at = now(),
           resolved_at  = NULL`,
    [kind, subject, JSON.stringify(detail)],
  );
}

/**
 * Who owns this slug, when it is not the caller.
 *
 * Returns null when the slug is free or already this product's.
 */
async function claimSlug(
  client: PoolClient,
  productId: string,
  slug: string,
): Promise<string | null> {
  const existing = await client.query<{ hostinger_product_id: string }>(
    `SELECT hostinger_product_id FROM catalogue_products WHERE slug = $1`,
    [slug],
  );
  const owner = existing.rows[0]?.hostinger_product_id;
  return owner && owner !== productId ? owner : null;
}

/**
 * Claim a SKU for a product.
 *
 * The conditional upsert is the enforcement point. `DO UPDATE … WHERE` only
 * fires when the incumbent *is* this product, so a re-sync is a no-op and a
 * different product returns zero rows — which is how a duplicate is detected,
 * by the constraint rather than by a prior read.
 */
async function claimSku(client: PoolClient, productId: string, sku: string): Promise<boolean> {
  const claimed = await client.query(
    `INSERT INTO catalogue_skus (sku, hostinger_product_id)
     VALUES ($1, $2)
     ON CONFLICT (sku) DO UPDATE
       SET hostinger_product_id = EXCLUDED.hostinger_product_id,
           claimed_at           = now()
       WHERE catalogue_skus.hostinger_product_id = EXCLUDED.hostinger_product_id
     RETURNING sku`,
    [sku, productId],
  );
  return (claimed.rowCount ?? 0) > 0;
}

/** Who currently holds this SKU — only asked when a claim has already failed. */
async function skuOwner(client: PoolClient, sku: string): Promise<string | null> {
  const row = await client.query<{ hostinger_product_id: string }>(
    `SELECT hostinger_product_id FROM catalogue_skus WHERE sku = $1`,
    [sku],
  );
  return row.rows[0]?.hostinger_product_id ?? null;
}

export async function syncCatalogue(products: Product[]): Promise<CatalogueSyncResult> {
  // Refusing an empty catalogue is the same guard the admin resync already
  // applies: an upstream blip that returns nothing must never be read as
  // "every product was removed".
  if (products.length === 0) {
    throw new Error('Catalogue sync aborted: the catalogue returned no products.');
  }

  // Stable order so a contested SKU resolves the same way on a fresh database
  // no matter what order the API happened to return.
  const ordered = [...products].sort((a, b) => a.id.localeCompare(b.id));

  return transaction(async (client) => {
    const result: CatalogueSyncResult = {
      productsSeen: ordered.length,
      productsActive: 0,
      productsQuarantined: 0,
      productsGrandfathered: 0,
      variantsSeen: 0,
      quarantined: [],
      grandfathered: [],
      alertsRaised: 0,
    };

    // Which products this mirror has seen before, and whether it has seen any.
    // See the module comment: this is what stops a sync withdrawing something
    // that is already on sale.
    const knownRows = await client.query<{ hostinger_product_id: string }>(
      `SELECT hostinger_product_id FROM catalogue_products`,
    );
    const known = new Set(knownRows.rows.map((row) => row.hostinger_product_id));
    const bootstrap = known.size === 0;

    const seenProductIds: string[] = [];
    const seenVariantIds: string[] = [];

    for (const product of ordered) {
      seenProductIds.push(product.id);
      const established = bootstrap || known.has(product.id);

      /* ------------------------------------------------------- slug */

      const slugHolder = await claimSlug(client, product.id, product.slug);

      if (slugHolder) {
        // The real slug belongs to the incumbent and the column is unique, so
        // the mirror stores the product id in its place. The alert carries the
        // slug that actually collided. Nothing routes off this column — the
        // storefront still resolves slugs through the provider snapshot.
        await client.query(
          `INSERT INTO catalogue_products (hostinger_product_id, slug, title, status)
           VALUES ($1, $1, $2, $3)
           ON CONFLICT (hostinger_product_id) DO UPDATE
             SET title = EXCLUDED.title, status = EXCLUDED.status, last_seen_at = now()`,
          [product.id, product.title, established ? 'active' : 'quarantined'],
        );
        await raiseAlert(client, 'duplicate_slug', product.slug, {
          slug: product.slug,
          heldBy: slugHolder,
          collidingProduct: product.id,
          title: product.title,
          action: established ? 'left_on_sale' : 'quarantined',
        });
        result.alertsRaised += 1;

        const collision: Collision = {
          productId: product.id,
          reason: 'duplicate_slug',
          subject: product.slug,
        };
        if (established) {
          result.productsGrandfathered += 1;
          result.grandfathered.push(collision);
        } else {
          result.productsQuarantined += 1;
          result.quarantined.push(collision);
        }
        continue;
      }

      await client.query(
        `INSERT INTO catalogue_products (hostinger_product_id, slug, title, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (hostinger_product_id) DO UPDATE
           SET slug         = EXCLUDED.slug,
               title        = EXCLUDED.title,
               status       = 'active',
               last_seen_at = now(),
               removed_at   = NULL`,
        [product.id, product.slug, product.title],
      );

      /* -------------------------------------------------------- skus */

      let lostSku: string | null = null;
      let lostTo: string | null = null;

      for (const variant of product.variants) {
        if (await claimSku(client, product.id, variant.sku)) continue;
        lostSku = variant.sku;
        lostTo = await skuOwner(client, variant.sku);
        break;
      }

      if (lostSku) {
        const collision: Collision = {
          productId: product.id,
          reason: 'duplicate_sku',
          subject: lostSku,
        };

        if (established) {
          result.productsGrandfathered += 1;
          result.grandfathered.push(collision);
        } else {
          // A new arrival on a SKU somebody already holds: the case the
          // constraint exists for. It keeps whatever SKUs it did win, because
          // releasing them would let a third product claim them next pass.
          await client.query(
            `UPDATE catalogue_products SET status = 'quarantined', last_seen_at = now()
              WHERE hostinger_product_id = $1`,
            [product.id],
          );
          result.productsQuarantined += 1;
          result.quarantined.push(collision);
        }

        await raiseAlert(client, 'duplicate_sku', lostSku, {
          sku: lostSku,
          heldBy: lostTo,
          collidingProduct: product.id,
          title: product.title,
          action: established ? 'left_on_sale' : 'quarantined',
        });
        result.alertsRaised += 1;

        // A grandfathered product still gets its variants mirrored below. A
        // quarantined one does not need them, and skipping keeps the mirror
        // free of rows for something withheld.
        if (!established) continue;
      } else {
        result.productsActive += 1;
      }

      /* ---------------------------------------------------- variants */

      for (const variant of product.variants) {
        seenVariantIds.push(variant.id);
        result.variantsSeen += 1;
        await client.query(
          `INSERT INTO catalogue_variants
             (hostinger_variant_id, hostinger_product_id, sku, title)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (hostinger_variant_id) DO UPDATE
             SET hostinger_product_id = EXCLUDED.hostinger_product_id,
                 sku                  = EXCLUDED.sku,
                 title                = EXCLUDED.title,
                 last_seen_at         = now(),
                 removed_at           = NULL`,
          [variant.id, product.id, variant.sku, variant.title],
        );
      }
    }

    /* ------------------------------------------------- disappearances */

    // Marked, never deleted: orders still reference these ids, and
    // `inventory_baseline` may still carry unreconciled sales against them.
    await client.query(
      `UPDATE catalogue_products SET removed_at = now()
        WHERE hostinger_product_id <> ALL($1::text[]) AND removed_at IS NULL`,
      [seenProductIds],
    );
    await client.query(
      `UPDATE catalogue_variants SET removed_at = now()
        WHERE hostinger_variant_id <> ALL($1::text[]) AND removed_at IS NULL`,
      [seenVariantIds],
    );

    /* ----------------------------------------------------- enrichment */

    // The same signal the admin banner already shows, now durable. A product
    // filed by title matching has lost its taxonomy and needs a human.
    const unmapped = unmappedProductIds(
      ordered.map((product) => ({
        productId: product.id,
        title: product.title,
        subtitle: product.subtitle,
        slug: product.slug,
        skus: product.variants.map((variant) => variant.sku),
      })),
    );
    for (const productId of unmapped) {
      const product = ordered.find((candidate) => candidate.id === productId);
      await raiseAlert(client, 'unmapped_enrichment', productId, {
        productId,
        title: product?.title ?? null,
      });
      result.alertsRaised += 1;
    }

    // Anything that recovered since the last sync stops being an open alert.
    await client.query(
      `UPDATE catalogue_alerts SET resolved_at = now()
        WHERE kind = 'unmapped_enrichment'
          AND resolved_at IS NULL
          AND subject <> ALL($1::text[])`,
      [unmapped],
    );

    return result;
  });
}

/**
 * Product ids the storefront must not show.
 *
 * Read separately from the sync so a page render never depends on one having
 * just run. An empty set is the correct answer on a database that has never
 * been synced, which keeps the mock provider and a cold install working.
 */
export async function quarantinedProductIds(): Promise<Set<string>> {
  const rows = await query<{ hostinger_product_id: string }>(
    `SELECT hostinger_product_id FROM catalogue_products WHERE status = 'quarantined'`,
  );
  return new Set(rows.map((row) => row.hostinger_product_id));
}

/**
 * Mark an alert acknowledged.
 *
 * Deliberately not a delete: the history of what collided, and when, is the
 * part worth keeping. A recurrence re-opens the same row rather than creating
 * a second one.
 */
export async function resolveCatalogueAlert(kind: string, subject: string): Promise<void> {
  await query(
    `UPDATE catalogue_alerts SET resolved_at = now()
      WHERE kind = $1 AND subject = $2 AND resolved_at IS NULL`,
    [kind, subject],
  );
}

export interface CatalogueAlert {
  kind: AlertKind;
  subject: string;
  detail: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** Open alerts for the admin banner, newest first. */
export async function openCatalogueAlerts(): Promise<CatalogueAlert[]> {
  const rows = await query<{
    kind: AlertKind;
    subject: string;
    detail: Record<string, unknown>;
    first_seen_at: Date;
    last_seen_at: Date;
  }>(
    `SELECT kind, subject, detail, first_seen_at, last_seen_at
       FROM catalogue_alerts
      WHERE resolved_at IS NULL
      ORDER BY last_seen_at DESC`,
  );

  return rows.map((row) => ({
    kind: row.kind,
    subject: row.subject,
    detail: row.detail,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  }));
}
