-- A customer address book.
--
-- Purely additive: one new table, nothing existing is altered. Nothing reads it
-- yet except the account page — checkout keeps collecting its own address and
-- keeps snapshotting it into `orders.shipping_address`, exactly as it does
-- today. Wiring the two together is a later, separate change.
--
-- **`orders.shipping_address` stays a jsonb snapshot and nothing here becomes a
-- foreign key to it.** That is the whole reason a past order cannot change when
-- a customer edits or deletes a saved address: the order copied the values, it
-- does not point at them. Any future work that is tempted to replace the
-- snapshot with a reference to `customer_addresses` would silently rewrite
-- delivery history, which is a record we may have to stand behind.
--
-- Rollback: DROP TABLE customer_addresses;

BEGIN;

CREATE TABLE customer_addresses (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- Mirrors `ShippingAddress` in `src/lib/orders/types.ts` field for field, on
  -- purpose: checkout can then pass a saved row straight into the order
  -- snapshot with no mapping layer, and no opportunity for a mapping layer to
  -- drop `landmark` or reorder `line1`/`line2`.
  line1       text NOT NULL,
  line2       text,
  landmark    text,
  city        text NOT NULL,
  state       text NOT NULL,
  pincode     text NOT NULL,

  -- The recipient, who is not always the account holder: a parcel goes to a
  -- person at a place, and "deliver to my parents" is an ordinary thing to
  -- want. `orders` already keeps `customer_name` and `customer_phone`
  -- separately from the address for the same reason.
  --
  -- Both NOT NULL because `placeOrderSchema` requires a name and a phone on
  -- every order. An address saved without them could not prefill a checkout,
  -- which would make it a saved address that does not work — worse than none.
  recipient_name  text NOT NULL,
  recipient_phone text NOT NULL,

  is_default  boolean NOT NULL DEFAULT false,

  -- Soft delete. A hard delete of a row a customer is part-way through
  -- checking out with turns a working prefill into a crash, and afterwards
  -- "where did my address go" has no answer. Archived rows are excluded from
  -- every listing by the partial indexes below.
  archived_at timestamptz,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- An archived address cannot be the default one. Enforced here rather than
  -- left to the application because "archive the default" is the exact
  -- sequence that would otherwise strand a customer with a default they can
  -- no longer see or replace.
  CONSTRAINT customer_addresses_archived_not_default
    CHECK (NOT (is_default AND archived_at IS NOT NULL))
);

/*
 * Deduplication, computed by the database.
 *
 * Checkout's "save this address" checkbox would otherwise add a near-identical
 * row per order, and an address book holding eleven copies of one address is
 * worse than no address book. Normalising here rather than in application code
 * means the key cannot drift from the data it is derived from, and cannot be
 * bypassed by a second writer.
 *
 * Case and internal whitespace are flattened, so "12  MG road" and "12 MG Road"
 * are one address. The recipient is part of the key on purpose: the same street
 * address for two different people is two genuine entries, not a duplicate.
 */
ALTER TABLE customer_addresses
  ADD COLUMN address_digest text
  GENERATED ALWAYS AS (
    md5(
      lower(regexp_replace(btrim(line1), '\s+', ' ', 'g'))                    || '|' ||
      lower(regexp_replace(btrim(coalesce(line2, '')), '\s+', ' ', 'g'))      || '|' ||
      lower(regexp_replace(btrim(coalesce(landmark, '')), '\s+', ' ', 'g'))   || '|' ||
      lower(regexp_replace(btrim(city), '\s+', ' ', 'g'))                     || '|' ||
      lower(regexp_replace(btrim(state), '\s+', ' ', 'g'))                    || '|' ||
      btrim(pincode)                                                          || '|' ||
      lower(regexp_replace(btrim(recipient_name), '\s+', ' ', 'g'))           || '|' ||
      btrim(recipient_phone)
    )
  ) STORED;

-- The listing: this customer's live addresses, newest first.
CREATE INDEX customer_addresses_user_idx
  ON customer_addresses (user_id, created_at DESC)
  WHERE archived_at IS NULL;

-- At most one default per customer, decided by the database rather than by
-- whichever request happened to run last. Partial on `archived_at` as well, or
-- an archived default would occupy the slot for good — though the CHECK above
-- already makes that combination impossible, so this is belt and braces.
CREATE UNIQUE INDEX customer_addresses_one_default
  ON customer_addresses (user_id)
  WHERE is_default AND archived_at IS NULL;

-- One live copy of any given address per customer. Archived rows are excluded
-- so that deleting an address and re-adding it later is allowed.
CREATE UNIQUE INDEX customer_addresses_no_duplicates
  ON customer_addresses (user_id, address_digest)
  WHERE archived_at IS NULL;

-- Customer addresses are personal data. 0002 revoked the anon and authenticated
-- roles across the schema and set default privileges so new tables inherit it;
-- stated explicitly here rather than inherited silently.
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON customer_addresses FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE customer_addresses_id_seq FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
