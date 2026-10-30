-- P1 store tasks from the 27 Oct tracker: refunds, staff-placed orders, call-backs.
--
--   R-12  order_refunds — one row per refund an admin starts from the order
--         page. The gateway's refund id is the dedupe key the webhook settles
--         on. Who refunded and why is kept here, not only in order_events, so
--         the cap ("never more than was paid", D-08) is a SUM over one table.
--         orders.cancellation_requested_at — the customer's "Request
--         cancellation" before dispatch.
--   R-18  orders.placed_by — the admin who placed the order for a customer
--         ("placed by staff"); NULL for every order the customer placed.
--         orders.payment_link_id / payment_link_url — the Razorpay payment link
--         sent to that customer. A link's payment arrives under a gateway order
--         Razorpay creates itself, so the webhook finds the order by link id.
--   R-13  checkout_callbacks — the "Called" tick on the call-back list, one row
--         per call, keyed by the order that was not paid or, for a signed-in
--         shopper who reached checkout and placed nothing, by the account.
--
-- Rollback:
--   DROP TABLE checkout_callbacks;
--   DROP TABLE order_refunds;
--   ALTER TABLE orders DROP COLUMN cancellation_requested_at,
--     DROP COLUMN cancellation_request_note, DROP COLUMN placed_by,
--     DROP COLUMN payment_link_id, DROP COLUMN payment_link_url;

BEGIN;

CREATE TABLE order_refunds (
  id                 bigserial PRIMARY KEY,
  order_id           bigint NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  provider           text   NOT NULL,
  gateway_payment_id text   NOT NULL,
  -- NULL only while the gateway call is in flight; a refund the gateway
  -- refused is kept as 'failed' with the reason, never deleted.
  gateway_refund_id  text,
  amount             bigint NOT NULL CHECK (amount > 0),
  status             text   NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processed', 'failed')),
  reason             text   NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
  requested_by       text   NOT NULL,
  error              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  UNIQUE (provider, gateway_refund_id)
);

CREATE INDEX order_refunds_order_idx ON order_refunds (order_id);

COMMENT ON TABLE order_refunds IS 'Refunds started from the admin order page (R-12). Pending and processed rows count toward the paid-amount cap.';

ALTER TABLE orders
  ADD COLUMN cancellation_requested_at timestamptz,
  ADD COLUMN cancellation_request_note text CHECK (cancellation_request_note IS NULL OR length(cancellation_request_note) <= 500),
  ADD COLUMN placed_by        text,
  ADD COLUMN payment_link_id  text UNIQUE,
  ADD COLUMN payment_link_url text CHECK (payment_link_url IS NULL OR payment_link_url ~ '^https://');

COMMENT ON COLUMN orders.cancellation_requested_at IS 'When the customer asked to cancel before dispatch (R-12).';
COMMENT ON COLUMN orders.placed_by IS 'Admin email when staff placed the order for the customer (R-18); NULL otherwise.';
COMMENT ON COLUMN orders.payment_link_id IS 'Razorpay payment link (plink_…) sent for a staff-placed order (R-18).';

-- Exactly one of order_id / user_id: an unpaid order, or a signed-in shopper
-- who reached checkout and placed nothing.
CREATE TABLE checkout_callbacks (
  id        bigserial PRIMARY KEY,
  order_id  bigint REFERENCES orders (id) ON DELETE CASCADE,
  user_id   bigint REFERENCES users (id) ON DELETE CASCADE,
  called_by text   NOT NULL,
  note      text   CHECK (note IS NULL OR length(note) <= 500),
  called_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((order_id IS NULL) <> (user_id IS NULL))
);

CREATE INDEX checkout_callbacks_order_idx ON checkout_callbacks (order_id, called_at DESC);
CREATE INDEX checkout_callbacks_user_idx ON checkout_callbacks (user_id, called_at DESC);

COMMENT ON TABLE checkout_callbacks IS 'The "Called" tick on Admin → Call-backs (R-13): who called an unpaid checkout, and when.';

-- Money and phone numbers: no access for the Supabase API roles, as for every
-- other table; the application reads through its own connection.
ALTER TABLE order_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_callbacks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON order_refunds FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON checkout_callbacks FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
