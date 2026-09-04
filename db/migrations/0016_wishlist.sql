-- A server-backed wishlist, so saved products follow the customer between
-- devices instead of living in one browser's localStorage.
--
-- Purely additive: one new table. Nothing existing is altered, and no other
-- table gains a column or a constraint.
--
-- Rollback: DROP TABLE wishlist_items;

BEGIN;

CREATE TABLE wishlist_items (
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  /*
   * The catalogue's own product id, and deliberately NOT a foreign key.
   *
   * `Product.id` in the domain layer is `products.product_key`
   * (`to-domain.ts:148`), so the ids already sitting in localStorage are valid
   * here unchanged — no migration of client data, no id translation.
   *
   * But the storefront is provider-agnostic. `COMMERCE_PROVIDER` defaults to
   * `mock`, and the Hostinger provider is still selectable; the ids those
   * return have no row in `products` at all. A foreign key would therefore make
   * "add to wishlist" throw on every developer machine and under Hostinger —
   * turning a saved-for-later into a hard failure over a product reference that
   * was never meant to be authoritative here.
   *
   * `order_items.product_id` is plain `text NOT NULL` with no foreign key for
   * exactly this reason (`0001_checkout.sql:92`), on the higher-stakes table.
   * This follows that precedent.
   *
   * A dangling id is handled where it is *read*: the list is resolved through
   * the catalogue and anything that no longer resolves is simply not rendered.
   * That is also the correct behaviour for a product that is unpublished or
   * withdrawn — the row stays, so the item reappears if it comes back, and
   * nothing is silently deleted from a customer's list on our say-so.
   */
  product_id text NOT NULL CHECK (length(product_id) BETWEEN 1 AND 200),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- One row per product per customer. The primary key *is* the uniqueness
  -- rule, so a duplicate is impossible rather than merely avoided: the merge on
  -- sign-in relies on `ON CONFLICT DO NOTHING` against this.
  PRIMARY KEY (user_id, product_id)
);

-- The listing: this customer's saved products, most recently added first.
CREATE INDEX wishlist_items_user_idx ON wishlist_items (user_id, created_at DESC);

-- What a customer has saved is personal data. 0002 revoked the anon and
-- authenticated roles across the schema and set default privileges so new
-- tables inherit it; stated explicitly here rather than inherited silently.
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON wishlist_items FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
