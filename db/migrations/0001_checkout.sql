-- iTarang checkout schema — LOCAL TESTING DATABASE (itarang_dev) ONLY.
--
-- Money is stored as bigint paise everywhere, matching the application's `Paise`
-- type and avoiding floating point entirely.
--
-- Orders snapshot their line items and shipping address rather than referencing
-- live catalogue or address rows: an order is a historical record and must not
-- change when a product is re-priced or an address is edited.

BEGIN;

-- ---------------------------------------------------------------- enums

CREATE TYPE order_status AS ENUM (
  'pending_payment',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
  'cancelled'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'authorized',
  'paid',
  'failed',
  'refunded'
);

CREATE TYPE reservation_state AS ENUM (
  'active',
  'consumed',
  'released',
  'expired'
);

-- --------------------------------------------------------------- orders

CREATE TABLE orders (
  id                bigserial PRIMARY KEY,
  order_number      text        NOT NULL UNIQUE,

  status            order_status   NOT NULL DEFAULT 'pending_payment',
  payment_status    payment_status NOT NULL DEFAULT 'pending',

  customer_name     text NOT NULL,
  customer_phone    text NOT NULL,
  customer_email    text,

  -- Snapshot, not a foreign key: the order must survive an address edit.
  shipping_address  jsonb NOT NULL,

  subtotal          bigint NOT NULL CHECK (subtotal        >= 0),
  product_savings   bigint NOT NULL DEFAULT 0 CHECK (product_savings >= 0),
  coupon_code       text,
  coupon_discount   bigint NOT NULL DEFAULT 0 CHECK (coupon_discount >= 0),
  shipping          bigint NOT NULL DEFAULT 0 CHECK (shipping        >= 0),
  cod_fee           bigint NOT NULL DEFAULT 0 CHECK (cod_fee         >= 0),
  total             bigint NOT NULL CHECK (total >= 0),

  -- GST captured now so a compliant invoice can be produced later.
  gst_amount        bigint NOT NULL DEFAULT 0 CHECK (gst_amount >= 0),
  gst_rate          numeric(5,4) NOT NULL DEFAULT 0.1800,
  place_of_supply   text,
  buyer_gstin       text,
  seller_gstin      text,

  payment_method    text NOT NULL,          -- 'cod' | 'mock' | 'razorpay-test'

  -- Every order created by a non-real payment path is marked permanently, in
  -- the data itself, so it can never be mistaken for a real sale later.
  is_test           boolean NOT NULL DEFAULT true,

  idempotency_key   text UNIQUE,            -- duplicate-submit protection
  gateway_order_id  text UNIQUE,            -- provider's order id, when any

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_phone_idx       ON orders (customer_phone);
CREATE INDEX orders_created_at_idx  ON orders (created_at DESC);
CREATE INDEX orders_status_idx      ON orders (status);

-- ---------------------------------------------------------- order items

CREATE TABLE order_items (
  id                    bigserial PRIMARY KEY,
  order_id              bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,

  product_id            text NOT NULL,
  variant_id            text NOT NULL,
  sku                   text NOT NULL,
  title                 text NOT NULL,
  variant_title         text,
  image                 text,

  unit_mrp              bigint NOT NULL CHECK (unit_mrp   >= 0),
  unit_price            bigint NOT NULL CHECK (unit_price >= 0),
  quantity              integer NOT NULL CHECK (quantity  >  0),
  line_total            bigint NOT NULL CHECK (line_total >= 0),

  hsn_code              text,
  tax_rate              numeric(5,4) NOT NULL DEFAULT 0.1800,
  installation_included boolean NOT NULL DEFAULT false
);

CREATE INDEX order_items_order_idx ON order_items (order_id);

-- ------------------------------------------------------------- payments

CREATE TABLE payments (
  id                  bigserial PRIMARY KEY,
  order_id            bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,

  provider            text NOT NULL,        -- 'mock' | 'razorpay-test'
  gateway_payment_id  text NOT NULL,
  status              payment_status NOT NULL,
  amount              bigint NOT NULL CHECK (amount >= 0),
  method              text,

  signature_verified  boolean NOT NULL DEFAULT false,
  error_code          text,
  error_description   text,

  created_at          timestamptz NOT NULL DEFAULT now(),

  -- A payment id is unique per provider; two providers could in principle
  -- mint the same string.
  UNIQUE (provider, gateway_payment_id)
);

CREATE INDEX payments_order_idx ON payments (order_id);

-- ------------------------------------------------------- webhook events

-- The duplicate-delivery guard. Gateways explicitly warn that the same event
-- may arrive more than once and out of order; the unique constraint makes a
-- replay a no-op rather than a second state change.
CREATE TABLE webhook_events (
  id            bigserial PRIMARY KEY,
  provider      text NOT NULL,
  event_id      text NOT NULL,
  event_type    text NOT NULL,
  payload       jsonb NOT NULL,
  received_at   timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,

  UNIQUE (provider, event_id)
);

-- --------------------------------------------------- stock reservations

CREATE TABLE stock_reservations (
  id          bigserial PRIMARY KEY,
  variant_id  text NOT NULL,
  order_id    bigint REFERENCES orders (id) ON DELETE CASCADE,
  quantity    integer NOT NULL CHECK (quantity > 0),
  state       reservation_state NOT NULL DEFAULT 'active',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Availability queries filter on (variant_id, state, expires_at); expiry is
-- evaluated lazily on read so correctness never depends on a scheduler.
CREATE INDEX stock_reservations_lookup_idx
  ON stock_reservations (variant_id, state, expires_at);
CREATE INDEX stock_reservations_order_idx ON stock_reservations (order_id);

-- ---------------------------------------------------- inventory baseline

-- Opening balance mirrored from Hostinger, which has no write API. Our ledger
-- derives availability from this minus active reservations and unreconciled
-- sales. Hostinger itself is never decremented.
CREATE TABLE inventory_baseline (
  variant_id          text PRIMARY KEY,
  hostinger_quantity  integer NOT NULL CHECK (hostinger_quantity >= 0),
  synced_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------- order events

CREATE TABLE order_events (
  id           bigserial PRIMARY KEY,
  order_id     bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  actor        text NOT NULL DEFAULT 'system',
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_events_order_idx ON order_events (order_id, created_at);

-- ---------------------------------------------------- coupon redemptions

CREATE TABLE coupon_redemptions (
  id           bigserial PRIMARY KEY,
  order_id     bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  code         text NOT NULL,
  phone        text NOT NULL,
  redeemed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coupon_redemptions_code_phone_idx ON coupon_redemptions (code, phone);

-- ------------------------------------------------------------- triggers

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
