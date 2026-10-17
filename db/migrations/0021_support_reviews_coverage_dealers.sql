-- Four storefront features that were screens without data behind them.
--
--   support_requests      complaints, warranty registrations and installation
--                         bookings — the forms existed but sent nothing.
--   product_reviews       ratings from verified buyers, moderated before they
--                         show. The review screen existed with nothing to show.
--   serviceable_pincodes  where we deliver. The pincode check was a checksum
--                         of the digits, refusing one valid pincode in eleven.
--   dealers               the dealer and service-centre locator's list.
--
-- Purely additive: four new tables, nothing existing altered.
--
-- Rollback:
--   DROP TABLE dealers;
--   DROP TABLE serviceable_pincodes;
--   DROP TABLE product_reviews;
--   DROP TABLE support_requests;

BEGIN;

/* --------------------------------------------------------- support requests */

-- One row per request a customer submits. `details` holds the fields that only
-- one kind of request has (a fault description, an installation slot) so a new
-- form field needs no migration; the columns are what every kind shares and
-- what the admin list filters on.
CREATE TABLE support_requests (
  id            bigserial PRIMARY KEY,
  -- What the customer quotes on the phone, e.g. CMP-261017-4F7Q.
  reference     text NOT NULL UNIQUE,
  kind          text NOT NULL CHECK (kind IN ('complaint', 'warranty', 'installation')),
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  phone         text NOT NULL CHECK (phone ~ '^[6-9][0-9]{9}$'),
  email         text,
  pincode       text CHECK (pincode IS NULL OR pincode ~ '^[1-9][0-9]{5}$'),
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The signed-in account, when there was one. Never taken from the form.
  user_id       bigint REFERENCES users (id) ON DELETE SET NULL,
  admin_note    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text
);

CREATE INDEX support_requests_status_idx ON support_requests (status, created_at DESC);
CREATE INDEX support_requests_phone_idx ON support_requests (phone);

/* ------------------------------------------------------------------ reviews */

-- One review per customer per product, from a customer who bought it.
-- `verified` is set by the application from the customer's paid orders at the
-- time of writing; it is stored rather than recomputed so a later refund does
-- not silently change what the page says about an old review.
CREATE TABLE product_reviews (
  id            bigserial PRIMARY KEY,
  product_key   text NOT NULL REFERENCES products (product_key) ON DELETE CASCADE,
  user_id       bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_name   text NOT NULL CHECK (length(author_name) BETWEEN 1 AND 80),
  city          text,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title         text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body          text NOT NULL CHECK (length(body) BETWEEN 10 AND 4000),
  verified      boolean NOT NULL DEFAULT false,
  -- Nothing a customer writes is shown until an administrator publishes it.
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'published', 'hidden')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  moderated_at  timestamptz,
  moderated_by  text,
  UNIQUE (product_key, user_id)
);

CREATE INDEX product_reviews_product_idx ON product_reviews (product_key, status, created_at DESC);
CREATE INDEX product_reviews_status_idx ON product_reviews (status, created_at DESC);

/* --------------------------------------------------------------- coverage */

-- Where we deliver, one row per pincode. Absent means "not confirmed", which
-- the checkout reports but does not refuse; `active = false` is an explicit
-- "we do not deliver here".
CREATE TABLE serviceable_pincodes (
  pincode        text PRIMARY KEY CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  city           text NOT NULL,
  state          text NOT NULL,
  delivery_days  smallint NOT NULL CHECK (delivery_days BETWEEN 1 AND 30),
  cod_available  boolean NOT NULL DEFAULT false,
  active         boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text
);

/* ------------------------------------------------------------------ dealers */

CREATE TABLE dealers (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  kind         text NOT NULL DEFAULT 'dealer' CHECK (kind IN ('dealer', 'service-centre')),
  address      text NOT NULL,
  city         text NOT NULL,
  state        text NOT NULL,
  pincode      text NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  phone        text,
  whatsapp     text,
  -- Optional; when both are present the page links to a map.
  latitude     numeric(9, 6),
  longitude    numeric(9, 6),
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text
);

CREATE INDEX dealers_pincode_idx ON dealers (pincode) WHERE active;
CREATE INDEX dealers_city_idx ON dealers (lower(city)) WHERE active;

/* ------------------------------------------------------------------ lockdown */

-- Names, phone numbers and addresses. Same posture as every other table: no
-- access for the Supabase API roles; the application reads through its own
-- connection.
ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE serviceable_pincodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON support_requests FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON product_reviews FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON serviceable_pincodes FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON dealers FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE support_requests_id_seq FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE product_reviews_id_seq FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE dealers_id_seq FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
