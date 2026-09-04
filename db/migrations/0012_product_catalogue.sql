-- Give the storefront a catalogue it owns.
--
-- `0008_catalogue_mirror.sql` opens by stating, correctly at the time, that
-- "there is no `products` table. The catalogue lives entirely in Hostinger and
-- is read-only here". This migration ends that arrangement for product
-- *content*.
--
-- What was wrong with the old arrangement is recorded in the codebase itself.
-- `hostinger/enrichment.ts` carries every fact the Sales Channel API cannot
-- supply — category, subcategory, highlights, box contents, FAQs, warranty,
-- badges, facets, cross-sell — keyed by a Hostinger product id, and its own
-- comment says that id "is not stable: recreating a product in hPanel mints a
-- new one and silently detaches its entry. That has already happened to this
-- catalogue twice, the second time to all six products at once."
--
-- So product content moves into our database, addressed by ids we mint.
-- Hostinger stays exactly as it is — the provider, the client, the mapper and
-- the inventory push loop are untouched and still selectable by
-- COMMERCE_PROVIDER. `products.hostinger_product_id` is kept as a nullable
-- REFERENCE so a future commerce integration can bind one of our products to an
-- upstream one without a schema change. It is never authoritative for content.
--
-- Three shape decisions worth stating, because the obvious alternatives are
-- worse:
--
--   1. NOT one wide table. A 51V traction pack and a wall-mounted home battery
--      share almost no technical vocabulary — the first has a discharge cut-off
--      voltage and a connector pin map, the second an IP rating and an inverter
--      charging profile. Columns for the union of both would be mostly NULL and
--      would need a migration for every new category. Technical figures are
--      therefore ROWS in product_spec_groups / product_specs, which is exactly
--      the `SpecGroup` shape the PDP already renders.
--
--   2. Structured columns only for stable business concepts — identity,
--      taxonomy, pricing, warranty, publishing. Those are queried, filtered and
--      constrained, so they are columns with CHECK constraints, not jsonb.
--
--   3. jsonb only for ordered lists of plain strings (description paragraphs,
--      highlights, box contents) and for the per-kind payload of
--      product_sections, which is validated by zod in the application. A table
--      per string list would be six join tables for no gain.
--
-- Nothing here is destructive. No existing table is dropped, altered or read.
-- catalogue_products / catalogue_variants / catalogue_skus keep their exact
-- meaning: an identity mirror of what Hostinger is serving. They are a
-- different thing from these tables and are deliberately not merged with them.

BEGIN;

-- --------------------------------------------------------------- parties

-- Manufacturer and seller are separate rows, not columns on a product, and not
-- the same record.
--
-- The PDP has been conflating them: its card is titled "Manufacturer Detail"
-- and renders `product.seller`. For these products those are genuinely
-- different companies — one manufactures, another markets and sells — and
-- Legal Metrology wants both stated. One row each, shared by every product.

CREATE TABLE manufacturers (
  id   bigserial PRIMARY KEY,
  -- Stable human-chosen key, so a seed can upsert without guessing an id.
  key  text NOT NULL UNIQUE,

  name       text NOT NULL,
  -- Nullable on purpose: seven of the eight source documents say "confirm exact
  -- legal name and registered address". An unconfirmed legal name must render
  -- as nothing, never as a plausible guess.
  legal_name text,
  address    text,
  website    text,
  email      text,
  phone      text,
  country_of_origin text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER manufacturers_touch_updated_at
  BEFORE UPDATE ON manufacturers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE sellers (
  id  bigserial PRIMARY KEY,
  key text NOT NULL UNIQUE,

  name    text NOT NULL,
  address text,

  customer_care_phone     text,
  customer_care_email     text,
  gstin                   text,
  grievance_officer_name  text,
  grievance_officer_phone text,
  -- Legal Metrology "packed by", when it differs from the marketer.
  packed_by               text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER sellers_touch_updated_at
  BEFORE UPDATE ON sellers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- -------------------------------------------------------------- products

CREATE TABLE products (
  id bigserial PRIMARY KEY,

  -- The id the storefront sees as `Product.id`. Minted by us, never derived
  -- from an upstream system, so recreating anything anywhere cannot detach a
  -- product from its own content.
  product_key text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,

  -- draft      not on the storefront; the only state an incomplete product may
  --            occupy. A product whose price is not yet known lives here.
  -- published  served by DbCatalogProvider.
  -- archived   withdrawn. NOT deleted: order_items snapshots product ids, and a
  --            deleted product would strand them.
  status text NOT NULL DEFAULT 'draft'
         CHECK (status IN ('draft', 'published', 'archived')),

  brand        text,
  title        text NOT NULL,
  subtitle     text NOT NULL DEFAULT '',
  model_name   text,
  generic_name text,
  product_type text,
  net_quantity text,

  category    text NOT NULL,
  subcategory text NOT NULL,
  -- Which generated illustration stands in when a product has no media yet.
  art         text NOT NULL DEFAULT 'battery',

  -- Ordered lists of plain strings. See decision 3 in the header.
  description       jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlights        jsonb NOT NULL DEFAULT '[]'::jsonb,
  box_contents      jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- NULL, not '[]': the PDP renders no care block at all when the source states
  -- none, which is a different thing from stating an empty one.
  care_instructions jsonb,

  country_of_origin text,

  -- Every warranty field is nullable, and that is load-bearing rather than lax.
  -- `types.ts` states the rule: a warranty is a commercial promise a customer
  -- can act on, so an unknown warranty renders as NOTHING rather than as a
  -- plausible default. Five of the eight source documents say
  -- "[insert Trontek warranty terms]" — those products get NULL and their PDP
  -- prints no warranty paragraph.
  --
  -- `warranty_text` carries the verbatim commercial phrase when one exists
  -- ("3 years or 1200 cycles, whichever is earlier"); months and cycles carry
  -- the same promise in the machine-readable form the facets and the compare
  -- table need.
  warranty_months integer CHECK (warranty_months > 0),
  warranty_cycles integer CHECK (warranty_cycles > 0),
  warranty_text   text,

  installation_included boolean NOT NULL DEFAULT false,
  return_window_days    integer CHECK (return_window_days > 0),

  -- ON DELETE SET NULL, not CASCADE: removing a manufacturer row must never
  -- take products with it.
  manufacturer_id bigint REFERENCES manufacturers (id) ON DELETE SET NULL,
  seller_id       bigint REFERENCES sellers (id)       ON DELETE SET NULL,

  hsn_code text,
  -- Stored as a fraction (0.1800 = 18%), matching orders.gst_rate.
  tax_rate numeric(5,4) CHECK (tax_rate >= 0 AND tax_rate <= 1),

  -- ProductFacetValues and BadgeKind[] respectively. Both are small, closed,
  -- application-validated shapes, read as a whole and never queried by key.
  facets jsonb NOT NULL DEFAULT '{}'::jsonb,
  badges jsonb NOT NULL DEFAULT '[]'::jsonb,

  launched_at     date,
  popularity_rank integer,

  seo_title       text,
  seo_description text,

  -- Reference only. Nullable, unconstrained, and never read for content.
  hostinger_product_id text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  archived_at  timestamptz,
  -- Admin email, so history answers *who*, matching order_events.actor.
  created_by text,
  updated_by text
);

COMMENT ON COLUMN products.status IS
  'draft products are invisible to the storefront and are the only state an '
  'incomplete product may occupy. archived is a withdrawal, never a delete: '
  'order_items snapshots product ids.';

COMMENT ON COLUMN products.hostinger_product_id IS
  'Reference to an upstream Hostinger product, kept so a future commerce or '
  'inventory integration can bind the two. Never a source of product content.';

CREATE TRIGGER products_touch_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- The storefront only ever asks for published rows, so the listing index is
-- partial and stays proportional to what is on sale rather than to everything
-- ever drafted.
CREATE INDEX products_listing_idx
  ON products (category, subcategory, popularity_rank)
  WHERE status = 'published';

-- The admin console asks the opposite question: show me everything, newest
-- first, optionally narrowed by status.
CREATE INDEX products_admin_idx ON products (status, updated_at DESC);

-- -------------------------------------------------------------- variants

CREATE TABLE product_variants (
  id         bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,

  variant_key text NOT NULL,

  -- UNIQUE across the whole table, and that is the point.
  --
  -- `catalogue_skus.sku` is a primary key for exactly this reason, argued at
  -- length in 0008: order_items.sku is the snapshot an invoice is built from,
  -- so a SKU shared by two products contaminates permanent financial records
  -- the moment either one sells. The same rule has to hold for our own
  -- products, and here it can be enforced at insert time rather than detected
  -- afterwards.
  sku text NOT NULL UNIQUE,

  title         text NOT NULL DEFAULT '',
  option_values jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Nullable so a draft can exist before its commercial terms do. One of the
  -- eight source documents has "[insert]" for both MRP and selling price; that
  -- product must be storable and must not be publishable. The publish gate in
  -- the application enforces the second half.
  mrp     bigint CHECK (mrp >= 0),
  selling bigint CHECK (selling >= 0),

  -- Stock and availability are separate because there is no inventory feed for
  -- our own products yet. `availability` is an explicit statement; `stock` is a
  -- number when one is genuinely known. Leaving stock at 0 to mean "unknown"
  -- would paint every card "Sold out", which is a claim we would be inventing.
  stock        integer CHECK (stock >= 0),
  availability text CHECK (availability IN
                 ('in-stock', 'low-stock', 'out-of-stock', 'preorder')),

  position integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (product_id, variant_key)
);

CREATE TRIGGER product_variants_touch_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX product_variants_product_idx ON product_variants (product_id, position);

-- ----------------------------------------------------------------- media

-- Binaries live in Supabase Storage; this table holds the object key and the
-- metadata a gallery needs. The public URL is DERIVED at read time from
-- SUPABASE_URL, the bucket and storage_path — storing a full URL would bake the
-- project host into every row and break on a bucket or project move.

CREATE TABLE product_media (
  id         bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,

  -- Object key within the bucket, e.g. products/trontek-tk12100/0-battery.jpg.
  -- UNIQUE so a re-run of the media import cannot create a second row pointing
  -- at one object.
  storage_path text NOT NULL UNIQUE,

  alt_text text NOT NULL DEFAULT '',
  -- What the image actually shows. The supplied set is four composed marketing
  -- images per product rather than four photographs, and the role is what lets
  -- the gallery and the admin tell them apart.
  role text NOT NULL DEFAULT 'other'
       CHECK (role IN ('battery', 'size', 'electrical', 'listing', 'other')),

  mime   text,
  bytes  integer CHECK (bytes >= 0),
  width  integer CHECK (width > 0),
  height integer CHECK (height > 0),

  position   integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX product_media_product_idx ON product_media (product_id, position);

-- At most one primary image per product, enforced rather than assumed: the
-- gallery and every product card read images[0], and two rows claiming primacy
-- would make that order depend on the planner.
CREATE UNIQUE INDEX product_media_primary_idx
  ON product_media (product_id)
  WHERE is_primary;

-- -------------------------------------------------------- specifications

-- The category-specific half of the model, and the reason there is no wide
-- table. A 2-wheeler traction pack carries "Electrical characteristics",
-- "Operation conditions", "Mechanical characteristics", "BMS / PCM protection
-- functions" and sometimes "Connector pin details". A home storage battery
-- carries one "Technical specifications" block with an IP rating and an
-- inverter charging profile. Neither is forced to carry the other's fields.
--
-- This is deliberately the exact shape of the `SpecGroup` type the PDP already
-- renders, so displaying it needs no component change.

CREATE TABLE product_spec_groups (
  id         bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  title      text NOT NULL,
  position   integer NOT NULL DEFAULT 0
);

CREATE INDEX product_spec_groups_product_idx
  ON product_spec_groups (product_id, position);

CREATE TABLE product_specs (
  id       bigserial PRIMARY KEY,
  group_id bigint NOT NULL REFERENCES product_spec_groups (id) ON DELETE CASCADE,
  label    text NOT NULL,
  value    text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE INDEX product_specs_group_idx ON product_specs (group_id, position);

-- ------------------------------------------------------------------ faqs

CREATE TABLE product_faqs (
  id         bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  question   text NOT NULL,
  answer     text NOT NULL,
  position   integer NOT NULL DEFAULT 0
);

CREATE INDEX product_faqs_product_idx ON product_faqs (product_id, position);

-- -------------------------------------------------------------- sections

-- The rich PDP blocks below the fold: recommended applications, charging,
-- discharge, run times, compatibility and care.
--
-- These exist today only as a hard-coded fixture (`DEMO_SECTIONS`) rendered for
-- the demo product alone, because there was nowhere for a real product to keep
-- them. This table is that home.
--
-- `payload` is jsonb rather than six more tables because the six kinds have six
-- genuinely different shapes — a list of titled cards, a summary plus
-- label/value pairs, a three-column table, a bullet list — and each is written
-- and read as one whole. The application validates each kind against its own
-- zod schema before writing, so the shape is enforced; it is simply enforced in
-- one place rather than by twenty columns that are NULL five times out of six.

CREATE TABLE product_sections (
  id         bigserial PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,

  kind text NOT NULL CHECK (kind IN (
         'applications',
         'charging',
         'discharge',
         'runtime',
         'compatibility',
         'care'
       )),

  payload  jsonb NOT NULL,
  position integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- One section of each kind per product. Two "charging" blocks on one page is
  -- an editing mistake, not a layout.
  UNIQUE (product_id, kind)
);

CREATE TRIGGER product_sections_touch_updated_at
  BEFORE UPDATE ON product_sections
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE INDEX product_sections_product_idx ON product_sections (product_id, position);

-- -------------------------------------------------------------- lockdown

-- Same treatment 0002 gave the checkout tables and 0008 gave the mirror: row
-- level security with no policies, so the provider's auto-generated REST API
-- cannot reach any of this with a public key. ENABLE, never FORCE — the
-- application connects as the table owner and must remain exempt.
--
-- Worth stating for this migration in particular: product content is public by
-- nature, but WRITE access to it is not. An unlocked table here would let a
-- public key rewrite prices and warranty terms.

ALTER TABLE manufacturers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_spec_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_specs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_faqs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sections    ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    EXECUTE 'REVOKE ALL ON manufacturers, sellers, products, product_variants, '
         || 'product_media, product_spec_groups, product_specs, product_faqs, '
         || 'product_sections FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';

  END IF;
END
$$;

COMMIT;
