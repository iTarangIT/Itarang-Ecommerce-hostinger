-- Push sold units back to Hostinger.
--
-- `0006_inventory_reconciliation.sql` opens by stating as fact that "Hostinger
-- exposes no inventory write API, so selling a unit here never decrements the
-- merchant's own stock". That was true of the *public* sales-channel API the
-- storefront reads, and is false of the authenticated account API:
--
--   PATCH /api/ecommerce/v1/stores/{store}/products/{product}/variants/batch
--   { "variants": [ { "variant_id": "…", "inventory_quantity": N } ] }
--
-- So the manual loop 0006 built — admin deducts by hand in hPanel, then presses
-- resync — can become automatic. `reconciled_at` keeps its exact meaning:
-- "these units are already accounted for upstream". Only the actor changes,
-- from a human to this queue. The manual path stays as a fallback.
--
-- Three properties of that endpoint dictate everything below.
--
--   1. `inventory_quantity` is an ABSOLUTE SET. There is no delta and no
--      atomic decrement, so the pusher must read, compute and write — a
--      read-modify-write, with every hazard that implies.
--   2. There is NO If-Match, ETag or version. No compare-and-swap is possible,
--      so a concurrent edit in hPanel cannot be detected by the API and has to
--      be detected by us.
--   3. There is NO idempotency key. A request that times out leaves the
--      outcome genuinely unknown: it may have applied, it may not.
--
-- (3) is the dangerous one. "Order succeeded, call decrement" would double-
-- decrement on any retry after a timeout. The defence is `expected_before` and
-- `expected_after`, written BEFORE the request goes out:
--
--   on retry, read the live quantity and compare
--     == expected_after   the write landed. Stamp, do not write again.
--     == expected_before  it did not land. Safe to write.
--     neither             the merchant edited hPanel in between. Stop,
--                         raise a drift alert, write nothing.
--
-- That turns an unknown outcome into a decidable one, which is the whole
-- reason this table exists rather than a fire-and-forget call in the webhook.

BEGIN;

CREATE TABLE inventory_sync_jobs (
  id       bigserial PRIMARY KEY,

  -- CASCADE matches every other order-scoped table: the job is meaningless
  -- without the order it came from.
  order_id bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,

  variant_id           text NOT NULL,
  -- The PATCH is addressed by product AND variant, but `inventory_baseline`
  -- only knows variants. Captured at enqueue time from `order_items`, which
  -- already snapshots both.
  hostinger_product_id text NOT NULL,

  units integer NOT NULL CHECK (units > 0),

  -- Exactly which reservation rows this job settles. Stamping `reconciled_at`
  -- by (variant, state) instead would sweep up sales that arrived after the
  -- quantity was computed and mark them deducted when they were not.
  reservation_ids bigint[] NOT NULL,

  -- Written before the request, read after a failure. See the header.
  expected_before integer,
  expected_after  integer,

  state text NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending', 'in_flight', 'applied', 'drift', 'failed', 'skipped')),

  attempts   integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  applied_at timestamptz,

  -- One job per variant per order. The webhook is already idempotent — the
  -- payment can only advance to `paid` once — but a unique constraint is
  -- cheaper than trusting that forever, and makes a redelivery provably safe.
  UNIQUE (order_id, variant_id)
);

COMMENT ON COLUMN inventory_sync_jobs.expected_after IS
  'The quantity the last PATCH attempted to set. On retry, live == this means '
  'the write landed despite the error, and must not be sent a second time.';

COMMENT ON COLUMN inventory_sync_jobs.state IS
  'pending -> in_flight -> applied. drift = upstream changed underneath us and '
  'a human must look. failed = retries exhausted. skipped = the variant no '
  'longer exists upstream, so there is nothing to deduct.';

-- The queue is a small minority of the table once applied rows accumulate, so
-- the index that finds work is partial — the same reasoning `0007` applied to
-- `payments_captured_idx`.
CREATE INDEX inventory_sync_pending_idx
  ON inventory_sync_jobs (created_at)
  WHERE state IN ('pending', 'in_flight');

-- What the admin panel lists: everything that needs a human.
CREATE INDEX inventory_sync_attention_idx
  ON inventory_sync_jobs (updated_at DESC)
  WHERE state IN ('drift', 'failed');

CREATE INDEX inventory_sync_order_idx ON inventory_sync_jobs (order_id);

CREATE TRIGGER inventory_sync_jobs_touch_updated_at
  BEFORE UPDATE ON inventory_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------- lockdown

-- Same treatment 0002 gave the checkout tables: row-level security with no
-- policies, so the provider's auto-generated REST API cannot reach any of this
-- with a public key. ENABLE, never FORCE — the application connects as the
-- table owner and must remain exempt.
ALTER TABLE inventory_sync_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    EXECUTE 'REVOKE ALL ON inventory_sync_jobs FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';

  END IF;
END
$$;

COMMIT;
