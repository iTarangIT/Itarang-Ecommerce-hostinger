-- Order stage dates, shipment details, and notes the customer does not see.
--
-- Stage dates: the order had only created_at/updated_at, and every other date
-- had to be dug out of order_events. Each stage now records when the order
-- first reached it — paid (payment received), confirmed, packed, shipped,
-- delivered, cancelled — set by the repository on each move. Existing orders
-- are backfilled from their history.
--
-- Shipment: courier, tracking number and link, and the delivery person and
-- phone, entered by the admin when the order ships (or later). Before this the
-- only place for them was the free-text note.
--
-- order_events.customer_visible: a note entered with a status change is shown
-- on the customer's order page and /track unless the admin unticks
-- "Show to customer" — for internal notes such as "customer asked to hold".
--
-- Rollback:
--   ALTER TABLE orders DROP COLUMN paid_at, DROP COLUMN confirmed_at, DROP COLUMN packed_at,
--     DROP COLUMN shipped_at, DROP COLUMN delivered_at, DROP COLUMN cancelled_at,
--     DROP COLUMN courier_name, DROP COLUMN tracking_number, DROP COLUMN tracking_url,
--     DROP COLUMN delivery_person, DROP COLUMN delivery_phone;
--   ALTER TABLE order_events DROP COLUMN customer_visible;

BEGIN;

ALTER TABLE orders
  ADD COLUMN paid_at         timestamptz,
  ADD COLUMN confirmed_at    timestamptz,
  ADD COLUMN packed_at       timestamptz,
  ADD COLUMN shipped_at      timestamptz,
  ADD COLUMN delivered_at    timestamptz,
  ADD COLUMN cancelled_at    timestamptz,
  ADD COLUMN courier_name    text CHECK (courier_name IS NULL OR length(courier_name) <= 80),
  ADD COLUMN tracking_number text CHECK (tracking_number IS NULL OR length(tracking_number) <= 80),
  ADD COLUMN tracking_url    text CHECK (tracking_url IS NULL OR (length(tracking_url) <= 500 AND tracking_url ~ '^https?://')),
  ADD COLUMN delivery_person text CHECK (delivery_person IS NULL OR length(delivery_person) <= 80),
  ADD COLUMN delivery_phone  text CHECK (delivery_phone IS NULL OR length(delivery_phone) <= 20);

ALTER TABLE order_events
  ADD COLUMN customer_visible boolean NOT NULL DEFAULT true;

-- Backfill from history: the first time each stage was entered.
UPDATE orders o SET
  paid_at      = (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'payment:paid'),
  confirmed_at = (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'confirmed'),
  packed_at    = (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'packed'),
  shipped_at   = (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'shipped'),
  delivered_at = (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'delivered'),
  cancelled_at = (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'cancelled');

COMMENT ON COLUMN orders.paid_at IS 'When payment was received (payment_status became paid).';
COMMENT ON COLUMN order_events.customer_visible IS 'False for internal admin notes, hidden from the customer.';

COMMIT;
