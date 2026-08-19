-- Payment attempt history, and making webhook processing recoverable.
--
-- Two defects this fixes, both of which lose money rather than merely
-- inconveniencing someone.
--
-- 1. `orders.gateway_order_id` held only the *latest* gateway order. Retrying a
--    payment overwrote it, so if the shopper had actually completed the first
--    attempt, that capture webhook arrived for an id no longer on any row: the
--    lookup missed, the event was acknowledged as "unmatched", and the order
--    stayed unpaid while the customer had been charged. Every attempt is now
--    recorded, and webhook matching falls back to this table.
--
-- 2. `webhook_events.processed_at` was stamped at INSERT, before the event had
--    been applied. A failure between recording and applying made the gateway's
--    retry look like a duplicate, so the update was lost permanently with
--    nothing to find it again. It is now stamped only after the work succeeds,
--    which turns `processed_at IS NULL` into a work queue.

BEGIN;

-- ---------------------------------------------------- payment attempts

CREATE TABLE payment_attempts (
  id                bigserial PRIMARY KEY,
  order_id          bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,

  provider          text NOT NULL,
  -- Unique across the table for the same reason `orders.gateway_order_id` was:
  -- webhook matching depends on one gateway order belonging to one of ours.
  gateway_order_id  text NOT NULL UNIQUE,

  amount            bigint NOT NULL CHECK (amount >= 0),

  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Stamped when a newer attempt replaces this one. Kept rather than deleted:
  -- a superseded attempt is exactly what a late webhook will reference.
  superseded_at     timestamptz
);

CREATE INDEX payment_attempts_order_idx ON payment_attempts (order_id, created_at DESC);

-- Backfill the attempt that each existing order is already carrying, so the
-- fallback lookup works for orders placed before this table existed.
INSERT INTO payment_attempts (order_id, provider, gateway_order_id, amount, created_at)
SELECT id, payment_method, gateway_order_id, total, created_at
  FROM orders
 WHERE gateway_order_id IS NOT NULL
ON CONFLICT (gateway_order_id) DO NOTHING;

-- ------------------------------------------------- webhook reprocessing

-- Finding the stragglers must not mean scanning the whole table. Partial index:
-- only unprocessed rows are indexed, and they are the only ones ever queried
-- this way.
CREATE INDEX webhook_events_unprocessed_idx
  ON webhook_events (received_at)
  WHERE processed_at IS NULL;

-- Rows written before this migration were stamped at insert and were, in fact,
-- processed — leaving them alone is correct. Nothing to backfill.

-- ------------------------------------------------------------- lockdown

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON payment_attempts FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
