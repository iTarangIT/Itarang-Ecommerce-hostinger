-- A "notify me" request is one-shot, and this column is how it is spent.
--
-- 0017 modelled a request as open until cancelled, and marked what had been
-- *sent* in a separate table keyed on the restock event. That answers "has this
-- person been told about restock 41?" and nothing else, so the admin list went
-- on showing everybody it had already emailed, greyed out, restock after
-- restock. The business asked for the opposite: a customer who has been told
-- leaves the list, so nobody can be mailed about the same product twice by an
-- administrator working down a list.
--
-- `notified_at` closes the request the moment the mail goes out. The request is
-- not deleted, for the same reason `cancelled_at` is not a delete: the row is
-- the record that the person asked, and the send history in
-- `stock_notification_sends` references transitions, not requests.
--
-- Asking again re-opens it. `requestStockNotification` clears both
-- `notified_at` and `cancelled_at` on conflict, so a customer who wants telling
-- about the next restock says so and is on the list again. That is the honest
-- reading of a control labelled "notify me when this is back" — it promises one
-- message, and the mail we send says as much.
--
-- Purely additive: one nullable column on one table. Every existing row keeps
-- its current meaning, and an unnotified request is exactly what NULL means, so
-- no backfill is needed.
--
-- Rollback:
--   DROP INDEX stock_notification_requests_waiting_idx;
--   ALTER TABLE stock_notification_requests DROP COLUMN notified_at;

BEGIN;

ALTER TABLE stock_notification_requests
  ADD COLUMN notified_at timestamptz;

COMMENT ON COLUMN stock_notification_requests.notified_at IS
  'When the back-in-stock mail was sent for this request. NULL means still waiting. Cleared if the customer asks again.';

-- The admin list, the waiting count and the internal alert all ask the same
-- question: who is still waiting for this product? A partial index over exactly
-- those rows keeps that question cheap as fulfilled requests accumulate.
--
-- The unique index from 0017 is untouched and still spans every request,
-- fulfilled or not: one row per person per variant remains the rule, and a
-- second sign-up must keep updating that row rather than inserting beside it.
CREATE INDEX stock_notification_requests_waiting_idx
  ON stock_notification_requests (product_id, created_at DESC)
  WHERE cancelled_at IS NULL AND notified_at IS NULL;

COMMIT;
