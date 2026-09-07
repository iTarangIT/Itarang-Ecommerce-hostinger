-- Back-in-stock notifications, and the out-of-stock alert that pairs with them.
--
-- Purely additive: four new tables. Nothing existing is altered, and no
-- existing table gains a column or a constraint. In particular
-- `product_variants.stock` remains the **only** record of how many units exist
-- — none of these tables stores a quantity, and nothing here is a second
-- inventory source. They record interest, transitions and sends; the stock
-- column continues to be written by exactly the two paths that write it today
-- (payment capture and the admin pricing form).
--
-- Rollback:
--   DROP TABLE stock_notification_sends;
--   DROP TABLE stock_transitions;
--   DROP TABLE stock_notification_requests;
--   DROP TABLE app_settings;

BEGIN;

/* ------------------------------------------------------------- settings */

-- A tiny key/value store for operational switches an administrator can flip.
--
-- Introduced for one switch — whether stock notification emails are sent at all
-- — and shaped as a table rather than an environment variable because the
-- business asked for it in the console, and a redeploy is not a control.
--
-- `value` is jsonb rather than text so a future setting can hold a shape
-- without another migration. Whoever adds the second key: the reader in
-- `lib/stock/settings.ts` validates with zod, so an unparseable value fails
-- closed rather than being coerced.
CREATE TABLE app_settings (
  key        text PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 100),
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The admin's email, matching `products.updated_by`, so "who turned this
  -- off?" is answerable.
  updated_by text
);

/* --------------------------------------------------- who wants to be told */

CREATE TABLE stock_notification_requests (
  id bigserial PRIMARY KEY,

  /*
   * The catalogue's own product id (`products.product_key`), and deliberately
   * NOT a foreign key — the same decision `wishlist_items.product_id` and
   * `order_items.product_id` make, for the same reason.
   *
   * The storefront is provider-agnostic. `COMMERCE_PROVIDER` can be `mock` or
   * `hostinger`, and the ids those return have no row in `products` at all. A
   * foreign key would make "notify me" throw on every developer machine and
   * under Hostinger, turning an interest capture into a hard failure over a
   * product reference that was never meant to be authoritative here.
   *
   * A dangling id is handled where it is read: the admin list resolves through
   * the catalogue and anything that no longer resolves is simply not rendered.
   */
  product_id text NOT NULL CHECK (length(product_id) BETWEEN 1 AND 200),

  /*
   * The variant, when the shopper was looking at one.
   *
   * NOT NULL with an empty-string default rather than nullable, so the unique
   * index below actually works: in Postgres, NULLs do not collide, so a
   * nullable column here would let the same person sign up for the same product
   * unboundedly many times.
   */
  sku text NOT NULL DEFAULT '' CHECK (length(sku) <= 200),

  /*
   * Set when a signed-in customer asks. SET NULL rather than CASCADE on delete,
   * matching `funnel_events.user_id`: removing a person must not silently
   * rewrite what happened, and the email column still carries the address the
   * request was made with.
   */
  user_id bigint REFERENCES users (id) ON DELETE SET NULL,

  -- Where the notification would go. Stored lower-cased by the application.
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),

  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Set when the customer asks to stop, rather than deleting the row, so a
  -- second sign-up does not resurrect an opt-out by conflicting with nothing.
  cancelled_at timestamptz
);

-- One live request per person per variant. `lower(email)` because an address is
-- case-insensitive in practice and a shopper who types it differently the
-- second time has not made a second request.
CREATE UNIQUE INDEX stock_notification_requests_unique
  ON stock_notification_requests (product_id, sku, lower(email));

-- The admin view: who is waiting for this product, most recent first.
CREATE INDEX stock_notification_requests_product_idx
  ON stock_notification_requests (product_id, created_at DESC);

/* ------------------------------------------------ what actually happened */

-- One row per genuine change of state, written in the same transaction as the
-- stock change that caused it.
--
-- **This table is the idempotency.** "Do not alert again while the product
-- stays out of stock" needs no de-duplication check and no cooldown window,
-- because staying out of stock produces no row: a row exists only where a
-- variant crossed from having units to having none, or back. Two alerts for one
-- transition would require two rows for one crossing, which the write path
-- cannot produce.
CREATE TABLE stock_transitions (
  id bigserial PRIMARY KEY,

  -- Unconstrained text for the same reason as above.
  product_id text NOT NULL CHECK (length(product_id) BETWEEN 1 AND 200),
  sku        text NOT NULL CHECK (length(sku) BETWEEN 1 AND 200),

  direction text NOT NULL CHECK (direction IN ('out-of-stock', 'back-in-stock')),

  occurred_at timestamptz NOT NULL DEFAULT now(),

  -- What caused it, for the admin list: 'order' (a sale consumed the last unit)
  -- or 'admin' (somebody edited the count).
  source text NOT NULL DEFAULT 'admin' CHECK (source IN ('order', 'admin')),

  /*
   * When the internal alert to the business was sent.
   *
   * NULL means "not sent yet", which after a failed send is the honest state
   * and leaves the row available for a retry. It is deliberately not a boolean:
   * "when" answers questions "whether" cannot.
   */
  alert_sent_at timestamptz
);

CREATE INDEX stock_transitions_sku_idx ON stock_transitions (sku, occurred_at DESC);
CREATE INDEX stock_transitions_pending_alert_idx
  ON stock_transitions (occurred_at)
  WHERE alert_sent_at IS NULL;

/* ------------------------------------------------------- what was sent */

-- One row per customer per restock event.
--
-- The primary key *is* the "no duplicate notification" rule, so a duplicate is
-- impossible rather than merely avoided: the send path inserts here with
-- ON CONFLICT DO NOTHING and only mails the addresses whose insert took. A
-- double-clicked "send" button, a retried action, or two administrators
-- pressing it at once therefore cannot produce two emails.
CREATE TABLE stock_notification_sends (
  transition_id bigint NOT NULL REFERENCES stock_transitions (id) ON DELETE CASCADE,
  email         text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  sent_at       timestamptz NOT NULL DEFAULT now(),
  -- Which admin pressed send.
  sent_by       text,

  PRIMARY KEY (transition_id, email)
);

/* ------------------------------------------------------------------ RLS */

-- Email addresses and what somebody is waiting for are personal data. 0002
-- revoked the anon and authenticated roles across the schema and set default
-- privileges so new tables inherit it; stated explicitly here rather than
-- inherited silently.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_notification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_notification_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON app_settings FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON stock_notification_requests FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON stock_transitions FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON stock_notification_sends FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE stock_notification_requests_id_seq FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE stock_transitions_id_seq FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
