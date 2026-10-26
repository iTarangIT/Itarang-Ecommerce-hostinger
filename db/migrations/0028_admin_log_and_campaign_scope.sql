-- Admin change log, product-level campaign scope, and a second stage-date backfill.
--
-- admin_events: every admin change to the catalogue — a product created,
-- edited, archived, repriced, its media changed; a category changed; a stock
-- alert handled; a pricing sheet imported. Shown under Logs → Product log with
-- who, when and what changed (old → new). Orders already have their own
-- history in order_events, which Logs → Order log reads as it is.
--
-- campaigns.product_ids: a campaign can now name single products as well as
-- whole categories and sub-categories. An item qualifies when it matches any
-- of the three.
--
-- Backfill: 0027 filled the stage dates from order_events only, so orders
-- whose history lacked a matching event kept a blank date. Fill what can still
-- be known: confirmed from the payment date for paid online orders, and any
-- stage still blank from its earliest event.
--
-- Rollback:
--   DROP TABLE admin_events;
--   ALTER TABLE campaigns DROP COLUMN product_ids;
--   (the backfill is not reversed; it only filled blanks)

BEGIN;

CREATE TABLE admin_events (
  id           bigserial PRIMARY KEY,
  entity_type  text NOT NULL CHECK (entity_type IN ('product', 'category', 'stock', 'pricing_import', 'campaign')),
  entity_id    text,
  entity_label text,
  action       text NOT NULL,
  actor        text NOT NULL,
  summary      text NOT NULL DEFAULT '',
  changes      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX admin_events_created_idx ON admin_events (created_at DESC);
CREATE INDEX admin_events_entity_idx ON admin_events (entity_type, entity_id);

COMMENT ON TABLE admin_events IS 'Admin changes to the catalogue, shown under Logs → Product log.';
COMMENT ON COLUMN admin_events.changes IS 'Array of {field, from, to} for the fields that changed.';

ALTER TABLE campaigns
  ADD COLUMN product_ids text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN campaigns.product_ids IS 'Single products the campaign applies to, besides its categories and sub-categories.';

UPDATE orders SET confirmed_at = paid_at
 WHERE confirmed_at IS NULL AND paid_at IS NOT NULL
   AND status IN ('confirmed', 'packed', 'shipped', 'delivered');

UPDATE orders o SET
  confirmed_at = COALESCE(o.confirmed_at, (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'confirmed')),
  packed_at    = COALESCE(o.packed_at,    (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'packed')),
  shipped_at   = COALESCE(o.shipped_at,   (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'shipped')),
  delivered_at = COALESCE(o.delivered_at, (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'delivered')),
  cancelled_at = COALESCE(o.cancelled_at, (SELECT min(created_at) FROM order_events e WHERE e.order_id = o.id AND e.to_status = 'cancelled'))
 WHERE o.confirmed_at IS NULL OR o.packed_at IS NULL OR o.shipped_at IS NULL
    OR o.delivered_at IS NULL OR o.cancelled_at IS NULL;

ALTER TABLE admin_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON admin_events FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
