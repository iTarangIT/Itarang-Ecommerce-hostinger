-- Cost price per variant: what the business pays for a unit.
--
-- Admin-only. It is never read by the storefront mapper (`to-domain.ts`) and
-- never leaves the admin console; it is edited on the product's Pricing tab and
-- through the bulk price sheet (Admin -> Products -> Bulk pricing), alongside
-- MRP, selling price, stock and availability. Paise, like every money column.
--
-- Nullable: "not entered yet" is different from "free".
--
-- Rollback:
--   ALTER TABLE product_variants DROP COLUMN cost_price;

BEGIN;

ALTER TABLE product_variants
  ADD COLUMN cost_price bigint CHECK (cost_price IS NULL OR cost_price >= 0);

COMMENT ON COLUMN product_variants.cost_price IS
  'Purchase cost per unit in paise. Admin-only; never shown on the storefront.';

COMMIT;
