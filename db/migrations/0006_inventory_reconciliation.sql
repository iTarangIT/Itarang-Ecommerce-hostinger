-- Closing the inventory ratchet.
--
-- Two facts about this system, both true before this migration:
--
--   1. Hostinger exposes no inventory write API, so selling a unit here never
--      decrements the merchant's own stock. Our ledger derives availability as
--      `inventory_baseline.hostinger_quantity` minus everything reserved or
--      sold, and the admin console prints a list of quantities to deduct by
--      hand in hPanel.
--   2. `syncInventoryBaseline()` existed, was on the repository interface, was
--      covered by tests — and was never called by any production code path.
--
-- Together those two made stock a one-way ratchet. The baseline was written
-- once, lazily, by the first order that touched a variant, and never again;
-- consumed reservations accumulated against it forever. Restocking in hPanel
-- could not raise availability, because order creation takes
-- `min(stored_baseline, live_hostinger)` and the stored figure was frozen low.
--
-- Simply resyncing the baseline is not the fix on its own, and would in fact
-- make things worse. Once the admin has deducted a sale in hPanel, Hostinger's
-- own number already reflects it — so continuing to subtract the consumed
-- reservation for that same sale double-counts it.
--
-- `reconciled_at` is the missing piece: it marks a consumed reservation whose
-- units are already accounted for upstream, so it stops being subtracted a
-- second time. NULL means "sold, not yet deducted in hPanel", which is the
-- correct reading of every row that exists today — hence no backfill.

BEGIN;

ALTER TABLE stock_reservations ADD COLUMN reconciled_at timestamptz;

COMMENT ON COLUMN stock_reservations.reconciled_at IS
  'Set when this sale has been deducted from Hostinger''s own stock, after which '
  'it no longer counts against the local baseline. NULL means not yet reconciled.';

-- Availability filters on (variant_id, state) and now also has to exclude
-- reconciled rows. The existing stock_reservations_lookup_idx covers
-- (variant_id, state, expires_at) for the active-reservation half; this covers
-- the consumed half.
CREATE INDEX stock_reservations_reconcile_idx
  ON stock_reservations (variant_id, state, reconciled_at);

-- ------------------------------------------------------------- lockdown

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON stock_reservations FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
