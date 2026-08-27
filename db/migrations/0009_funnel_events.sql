-- Customer funnel: the five stages nothing already records.
--
-- The temptation here is a general-purpose events table that logs everything.
-- That would duplicate infrastructure this schema already has, and would put
-- financial truth behind a browser claim. Neither is acceptable, so the split
-- below is deliberate and narrow:
--
--   stage              recorded where                       written by
--   ─────────────────  ───────────────────────────────────  ──────────
--   website visit      funnel_events                        client beacon
--   product view       funnel_events                        client beacon
--   buy now            funnel_events                        client beacon
--   add to cart        funnel_events                        client beacon
--   checkout reached   funnel_events                        SERVER
--   registration       users.created_at / sessions          (derived)
--   payment initiated  payment_attempts                     (derived)
--   payment completed  payments WHERE status='paid'         (derived)
--   order placed       order_events WHERE to_status=…       (derived)
--
-- The last four already exist, are already authoritative, and are already
-- indexed by 0007. Re-recording them here would create a second version of the
-- truth that a forged request could write to. They stay derived.
--
-- The first four are browser-only interactions the server genuinely cannot
-- observe — the cart lives in localStorage and never reaches us before
-- checkout — so a beacon is the only honest source. Nothing financial depends
-- on them.
--
-- `begin_checkout` is written server-side because /checkout is already
-- force-dynamic, so it costs nothing and cannot be forged.
--
-- PRIVACY. No name, e-mail, phone, address, IP or user-agent is stored here.
-- Identity is a `user_id` join performed inside admin queries only. `visitor_id`
-- is minted by the server into an HttpOnly cookie, so the browser cannot supply
-- or forge one, and it carries no personal data of its own.

BEGIN;

CREATE TYPE funnel_event AS ENUM (
  'visit',
  'product_view',
  'buy_now',
  'add_to_cart',
  'begin_checkout'
);

CREATE TABLE funnel_events (
  id          bigserial    PRIMARY KEY,
  event       funnel_event NOT NULL,
  occurred_at timestamptz  NOT NULL DEFAULT now(),

  -- Anonymous, server-minted, HttpOnly. Never accepted from a request body.
  visitor_id  uuid NOT NULL,
  -- 30-minute inactivity window. Conversion rates are computed on distinct
  -- sessions, not raw events, so one shopper viewing five products does not
  -- inflate the numerator.
  session_id  uuid NOT NULL,

  -- Resolved from the session cookie at write time, never from the client.
  -- SET NULL rather than CASCADE: deleting a person must not silently rewrite
  -- the shape of past funnels, the same reasoning 0003 applied to orders.
  user_id     bigint REFERENCES users (id) ON DELETE SET NULL,

  -- Hostinger ids. Deliberately unconstrained text, like order_items: the
  -- catalogue is upstream and a product may be recreated or removed there
  -- without invalidating what a shopper did.
  product_id  text,
  variant_id  text,

  quantity    integer CHECK (quantity > 0),
  -- Paise, consistent with every other money column in this schema.
  value       bigint  CHECK (value >= 0),

  -- Idempotency. A retried beacon, a double-fired effect under React strict
  -- mode, or a replayed request all collapse to one row.
  dedupe_key  text NOT NULL UNIQUE
);

COMMENT ON TABLE funnel_events IS
  'Pre-order funnel stages only. Payment and order stages are derived from '
  'orders/payments/order_events, which are authoritative — never from a client.';

COMMENT ON COLUMN funnel_events.visitor_id IS
  'Server-minted anonymous id from the itarang_vid HttpOnly cookie. Carries no '
  'personal data and is never accepted from a request body.';

-- One index per dashboard access pattern, and no more.
--
-- The last two are partial for the same reason 0007 made payments_captured_idx
-- partial: they stay proportional to the rows actually queried rather than to
-- the whole table, which matters most on the table that grows fastest.
CREATE INDEX funnel_events_stage_idx   ON funnel_events (event, occurred_at);
CREATE INDEX funnel_events_visitor_idx ON funnel_events (visitor_id, occurred_at);
CREATE INDEX funnel_events_product_idx ON funnel_events (product_id, event, occurred_at)
  WHERE product_id IS NOT NULL;
CREATE INDEX funnel_events_user_idx    ON funnel_events (user_id, occurred_at)
  WHERE user_id IS NOT NULL;

-- Retention is a sweep concern, not a storage one, but the index that supports
-- it belongs here: `db:sweep` deletes by age.
CREATE INDEX funnel_events_age_idx ON funnel_events (occurred_at);

-- ------------------------------------------------------------- identity

-- Anonymous browsing linked to an account at sign-in or registration.
--
-- Resolved at query time rather than by rewriting history: back-filling
-- `funnel_events.user_id` would rewrite what was true when the event happened,
-- and would have to be redone every time the same person signs in on a new
-- device. A composite primary key lets one person accumulate several visitor
-- ids and one shared device carry several people.
CREATE TABLE visitor_identities (
  visitor_id uuid   NOT NULL,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  linked_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (visitor_id, user_id)
);

CREATE INDEX visitor_identities_user_idx ON visitor_identities (user_id);

-- ---------------------------------------------------------- attribution

-- Which anonymous session produced an order.
--
-- A separate table rather than a column on `orders`, on purpose. `orders` is
-- the record an invoice is built from — it has a trigger, tight CHECKs and a
-- lockdown history — while attribution is analytics data with a different
-- retention policy and a different privacy posture. Keeping them apart means a
-- retention sweep here can never touch a financial row.
CREATE TABLE order_attribution (
  order_id   bigint PRIMARY KEY REFERENCES orders (id) ON DELETE CASCADE,
  visitor_id uuid,
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_attribution_visitor_idx ON order_attribution (visitor_id);

-- ------------------------------------------------------------- lockdown

-- Same treatment 0002 gave the checkout tables: row-level security with no
-- policies, so the provider's auto-generated REST API cannot reach any of this
-- with a public key. ENABLE, never FORCE — the application connects as the
-- table owner and must remain exempt.
--
-- This matters more here than almost anywhere else in the schema: these tables
-- answer "which customer looked at what", which is exactly the question a
-- public key must never be able to ask.
ALTER TABLE funnel_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_attribution  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    EXECUTE 'REVOKE ALL ON funnel_events, visitor_identities, order_attribution '
         || 'FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';

  END IF;
END
$$;

COMMIT;
