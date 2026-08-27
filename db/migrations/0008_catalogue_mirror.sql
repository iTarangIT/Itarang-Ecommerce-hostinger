-- Give duplicate products a constraint to violate.
--
-- Three facts about this system, all true before this migration:
--
--   1. There is no `products` table. The catalogue lives entirely in Hostinger
--      and is read-only here, so the only product-shaped uniqueness anywhere in
--      the database is `inventory_baseline.variant_id` — a row created lazily by
--      the *first order* touching a variant, not by any catalogue process.
--   2. Duplicate SKUs are therefore *detected* and never *prevented*.
--      `commerce/health.ts` recomputes the duplicate list on every request
--      inside `React.cache()` and renders a banner. Nothing is persisted, so
--      there is no history, no acknowledgement, and nothing to audit.
--   3. Duplicate slugs are not detected at all. `hostinger-provider.ts` resolves
--      `/p/[slug]` with `.find()`, so a second product carrying an existing
--      url_handle is silently unreachable — no warning, no log line.
--
-- A duplicate is not a display bug. `order_items.sku` is the snapshot an
-- invoice is built from, so a SKU shared by two products contaminates permanent
-- financial records the moment either one sells.
--
-- The rule this migration encodes is the one `health.ts` already states in
-- prose: "A product with several variants on one SKU is normal; two *products*
-- on one SKU is not." That is a mapping from SKU to product, so it is expressed
-- as a primary key on the SKU — not as a unique index on a variant column,
-- which would wrongly forbid the normal case.
--
-- Nothing here deletes or rewrites anything. A product that violates a
-- constraint is marked `quarantined` and recorded in `catalogue_alerts`; the
-- storefront filters it out and an admin decides what to do upstream.

BEGIN;

-- ------------------------------------------------------------- products

CREATE TABLE catalogue_products (
  hostinger_product_id text PRIMARY KEY,

  -- UNIQUE is the whole point: this is what turns the silent `.find()`
  -- shadowing into a loud, recorded rejection at ingestion time.
  slug   text NOT NULL UNIQUE,
  title  text NOT NULL,

  -- `quarantined` rows stay in the mirror on purpose. Deleting them would lose
  -- the evidence of what collided, and the next sync would rediscover the same
  -- collision with no memory of having seen it.
  status text NOT NULL DEFAULT 'active'
         CHECK (status IN ('active', 'quarantined')),

  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  -- Set when a product stops appearing upstream. Never deleted: orders still
  -- reference it, and `inventory_baseline` may still carry unreconciled sales.
  removed_at    timestamptz
);

COMMENT ON COLUMN catalogue_products.status IS
  'quarantined means this product lost a uniqueness contest at ingestion and is '
  'withheld from the storefront. It is never deleted — see catalogue_alerts.';

-- ------------------------------------------------------------- variants

CREATE TABLE catalogue_variants (
  hostinger_variant_id text PRIMARY KEY,
  hostinger_product_id text NOT NULL
    REFERENCES catalogue_products (hostinger_product_id) ON DELETE CASCADE,

  -- Deliberately NOT unique. Several variants of one product sharing a SKU is
  -- legitimate; the cross-product rule lives in catalogue_skus below.
  sku   text NOT NULL,
  title text,

  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  removed_at    timestamptz
);

CREATE INDEX catalogue_variants_product_idx
  ON catalogue_variants (hostinger_product_id);

CREATE INDEX catalogue_variants_sku_idx
  ON catalogue_variants (sku);

-- ----------------------------------------------------------------- skus

-- The rule, as a constraint: one SKU belongs to exactly one product.
--
-- A second product claiming a SKU that is already spoken for violates this
-- primary key. That is the moment a duplicate stops being a banner and starts
-- being a rejected write.
CREATE TABLE catalogue_skus (
  sku                  text PRIMARY KEY,
  hostinger_product_id text NOT NULL
    REFERENCES catalogue_products (hostinger_product_id) ON DELETE CASCADE,
  claimed_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX catalogue_skus_product_idx
  ON catalogue_skus (hostinger_product_id);

COMMENT ON TABLE catalogue_skus IS
  'One SKU maps to exactly one product. This is the duplicate-prevention '
  'constraint; a second product claiming the same SKU cannot be inserted.';

-- --------------------------------------------------------------- alerts

-- What the admin banner used to recompute per request, now durable.
--
-- UNIQUE (kind, subject) so re-observing the same problem on the next sync
-- updates `last_seen_at` rather than growing the table. `resolved_at` lets an
-- admin acknowledge something without deleting the record of it.
CREATE TABLE catalogue_alerts (
  id      bigserial PRIMARY KEY,
  kind    text NOT NULL CHECK (kind IN (
            'duplicate_sku',
            'duplicate_slug',
            'unmapped_enrichment',
            'orphan_variant',
            'inventory_drift'
          )),
  -- The sku, slug or variant id the alert is about.
  subject text NOT NULL,
  detail  jsonb NOT NULL DEFAULT '{}'::jsonb,

  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,

  UNIQUE (kind, subject)
);

-- The banner only ever asks for unresolved alerts, so the index is partial and
-- stays proportional to the open set rather than to the table's history.
CREATE INDEX catalogue_alerts_open_idx
  ON catalogue_alerts (last_seen_at DESC)
  WHERE resolved_at IS NULL;

-- ------------------------------------------------------------- lockdown

-- Same treatment 0002 gave the checkout tables: row-level security with no
-- policies, so the provider's auto-generated REST API cannot reach any of this
-- with a public key. ENABLE, never FORCE — the application connects as the
-- table owner and must remain exempt.
ALTER TABLE catalogue_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_skus     ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogue_alerts   ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    EXECUTE 'REVOKE ALL ON catalogue_products, catalogue_variants, '
         || 'catalogue_skus, catalogue_alerts FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';

  END IF;
END
$$;

COMMIT;
