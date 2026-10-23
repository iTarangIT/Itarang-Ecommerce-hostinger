-- Product categories, editable from the admin panel.
--
-- The taxonomy used to live only in code (`src/lib/commerce/mock/categories.ts`),
-- so adding a section such as "Inverters" needed a developer and a deploy. This
-- table holds the list the storefront navigation, the admin product form and
-- the category pages read from. One table for both levels: a row with no
-- `parent_slug` is a top-level category (the URL `/batteries`), a row with one
-- is a subcategory (`/batteries/ev-2-wheeler`).
--
-- Long editorial passages (SEO copy, highlights, filter set) stay in code for
-- the categories that already have them; a blank array here means "use the
-- built-in copy if there is any". A category added from the admin panel works
-- with just a name and a description.
--
-- `products.category` / `products.subcategory` stay plain text and are not
-- foreign keys: products imported before a category row existed must not break.
-- The admin action refuses to delete a category that still has products.
--
-- Rollback:
--   DROP TABLE catalog_categories;

BEGIN;

CREATE TABLE catalog_categories (
  slug        text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 60),
  parent_slug text REFERENCES catalog_categories (slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  short_name  text CHECK (short_name IS NULL OR length(short_name) BETWEEN 1 AND 40),
  tagline     text CHECK (tagline IS NULL OR length(tagline) <= 200),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  icon        text NOT NULL DEFAULT 'battery'
              CHECK (icon IN ('battery', 'charger', 'inverter', 'ups', 'combo')),
  seo_copy    text[] NOT NULL DEFAULT '{}',
  highlights  text[] NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 0,
  is_visible  boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_slug IS NULL OR parent_slug <> slug)
);

CREATE INDEX catalog_categories_parent_idx ON catalog_categories (parent_slug, sort_order);

COMMENT ON TABLE catalog_categories IS
  'Storefront categories (parent_slug NULL) and subcategories. Edited at /admin/categories.';

-- Today's taxonomy, so the storefront looks the same the moment this runs.
INSERT INTO catalog_categories (slug, parent_slug, name, short_name, description, icon, sort_order) VALUES
  ('batteries', NULL, 'Batteries', 'Batteries',
   'Lithium iron phosphate batteries for home backup and electric two- and three-wheelers.', 'battery', 10),
  ('chargers', NULL, 'Chargers', 'Chargers',
   'Lithium battery chargers for electric two- and three-wheelers.', 'charger', 20),
  ('ev-3-wheeler', 'batteries', '3-Wheeler & E-Rickshaw Batteries', NULL,
   'High-capacity LiFePO4 packs for e-rickshaws and e-loaders, sized in kWh for a day of duty.', 'battery', 10),
  ('ev-2-wheeler', 'batteries', '2-Wheeler EV Batteries', NULL,
   'LiFePO4 traction packs for electric scooters and motorcycles, matched by system voltage and connector.', 'battery', 20),
  ('home-inverter', 'batteries', 'Home Inverter Batteries', NULL,
   'Maintenance-free LiFePO4 batteries for household backup, matched to a lithium-ready inverter’s battery input and charging profile.', 'battery', 30),
  ('ess', 'batteries', 'ESS — Energy Storage Systems', NULL,
   'Wall- and rack-mounted LiFePO4 storage from 5 kWh upwards, for homes, shops and solar systems.', 'battery', 40),
  ('ev-chargers', 'chargers', 'EV Battery Chargers', NULL,
   'Chargers for 2-wheeler and 3-wheeler lithium packs, by output voltage and current.', 'charger', 10);

ALTER TABLE catalog_categories ENABLE ROW LEVEL SECURITY;

COMMIT;
