-- Coupon campaigns, configured from the admin panel.
--
-- Coupon codes used to be a hardcoded list (`src/lib/offers/coupons.ts`), so a
-- Diwali sale or a dealer-only offer needed a developer and a deploy. A row
-- here is one code with its discount and its rules:
--
--   kind / value        flat ₹ off (value in paise), percent off (value 1-100)
--                       or free shipping; max_discount caps a percentage
--   min_cart            minimum spend on qualifying products, paise
--   categories /        the code applies only when the cart holds products in
--   subcategories       these sections (empty = any product)
--   starts_at/ends_at   the campaign window (null = open-ended)
--   max_redemptions_total   uses across all customers (null = unlimited)
--   max_per_customer    uses per customer, by account or phone (null = unlimited)
--   first_order_only    only for a customer with no earlier confirmed order
--   cities / states     only when delivering there (empty = anywhere)
--   customer_phones     only these customers (empty = everyone)
--   customer_types      only customers of these types (users.customer_type)
--   show_on_site        listed on /offers and the home page
--
-- One code per order, as before; the UPI discount still stacks with it.
--
-- `users.customer_type` is a business label set by an admin on the customer's
-- page (retail, dealer, fleet, institutional). Null = not classified.
--
-- `coupon_redemptions.user_id` lets the per-customer limit follow the account,
-- not only the phone number typed at checkout. A redemption stops counting
-- when its order is cancelled or its payment window lapses (computed by the
-- query, so nothing needs to sweep it).
--
-- Rollback:
--   DROP TABLE campaigns;
--   ALTER TABLE users DROP COLUMN customer_type;
--   ALTER TABLE coupon_redemptions DROP COLUMN user_id;

BEGIN;

CREATE TABLE campaigns (
  id                    bigserial PRIMARY KEY,
  code                  text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  name                  text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  label                 text NOT NULL CHECK (length(label) BETWEEN 1 AND 120),
  description           text NOT NULL DEFAULT '' CHECK (length(description) <= 600),
  kind                  text NOT NULL CHECK (kind IN ('flat', 'percent', 'free-shipping')),
  value                 bigint NOT NULL DEFAULT 0 CHECK (value >= 0),
  max_discount          bigint CHECK (max_discount IS NULL OR max_discount > 0),
  min_cart              bigint CHECK (min_cart IS NULL OR min_cart >= 0),
  categories            text[] NOT NULL DEFAULT '{}',
  subcategories         text[] NOT NULL DEFAULT '{}',
  starts_at             timestamptz,
  ends_at               timestamptz,
  is_active             boolean NOT NULL DEFAULT true,
  show_on_site          boolean NOT NULL DEFAULT false,
  max_redemptions_total integer CHECK (max_redemptions_total IS NULL OR max_redemptions_total > 0),
  max_per_customer      integer CHECK (max_per_customer IS NULL OR max_per_customer > 0),
  first_order_only      boolean NOT NULL DEFAULT false,
  cities                text[] NOT NULL DEFAULT '{}',
  states                text[] NOT NULL DEFAULT '{}',
  customer_phones       text[] NOT NULL DEFAULT '{}',
  customer_types        text[] NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            text,
  updated_by            text,
  CHECK (kind <> 'percent' OR value BETWEEN 1 AND 100),
  CHECK (kind <> 'flat' OR value > 0),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE campaigns IS 'Coupon campaigns. Edited at /admin/campaigns.';

-- The two codes that were hardcoded, with the same rules.
INSERT INTO campaigns
  (code, name, label, description, kind, value, subcategories, max_per_customer, show_on_site, created_by)
VALUES
  ('WELCOME1000', 'Welcome — home inverter battery', '₹1,000 off home inverter batteries',
   '₹1,000 off when your cart includes a home inverter battery. One use per customer.',
   'flat', 100000, '{home-inverter}', 1, true, 'migration 0025'),
  ('WELCOME2000', 'Welcome — 3-wheeler battery', '₹2,000 off 3-wheeler batteries',
   '₹2,000 off when your cart includes a 3-wheeler or e-rickshaw battery. One use per customer.',
   'flat', 200000, '{ev-3-wheeler}', 1, true, 'migration 0025');

ALTER TABLE users
  ADD COLUMN customer_type text CHECK (customer_type IS NULL OR length(customer_type) BETWEEN 1 AND 40);

ALTER TABLE coupon_redemptions
  ADD COLUMN user_id bigint REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX coupon_redemptions_code_idx ON coupon_redemptions (upper(code));
CREATE INDEX coupon_redemptions_user_idx ON coupon_redemptions (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

COMMIT;
