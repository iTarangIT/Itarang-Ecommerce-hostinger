-- Indexes for the admin analytics screen.
--
-- No new columns. The schema already answers every question the reports ask —
-- `order_events` is the stage history, `payments` is the record of captured
-- money, and every timestamp is `timestamptz` so Asia/Kolkata bucketing is a
-- query concern rather than a storage one. What was missing was any way to
-- answer them without a sequential scan.
--
-- Two access patterns, one index each:
--
--   1. Revenue looks for captured payments and nothing else, so the payments
--      index is partial. `status = 'paid'` is a small minority of the table
--      once failed and authorized attempts accumulate, and a partial index
--      stays proportional to the rows actually queried rather than to the
--      table.
--
--   2. Fulfilment counts filter `order_events` by `to_status` and a time
--      window. The existing `order_events_order_idx (order_id, created_at)`
--      cannot serve that — it leads with the wrong column.
--
-- `orders_created_at_idx` and `orders_status_idx` already exist and are reused
-- for the pipeline query.

BEGIN;

CREATE INDEX payments_captured_idx
  ON payments (created_at)
  WHERE status = 'paid' AND signature_verified;

CREATE INDEX order_events_stage_idx
  ON order_events (to_status, created_at);

COMMIT;
