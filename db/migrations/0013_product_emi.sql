-- Make the EMI offer a property of the product, not of its price.
--
-- `PriceBlock` prints "Or ₹x/month on 6-month no-cost EMI" whenever a price is
-- at least ₹5,000 and the caller asked for it — and the buy box always asked
-- for it. That threshold was standing in for a commercial decision it cannot
-- make: every product in the catalogue costs more than ₹5,000, so every product
-- page advertised a financing arrangement nobody had agreed with a lender.
--
-- No-cost EMI is a real commercial commitment. It is negotiated per product or
-- per range, it costs the seller the interest the bank does not charge, and a
-- shopper who reaches checkout expecting it and does not find it has been
-- misled. So it becomes a stated fact about the product, defaulting to absent.
--
-- DEFAULT false, and the eight imported products are left on that default
-- deliberately: not one of their source documents mentions EMI, so there is
-- nothing to confirm. Turning it on is an act in the admin console, per
-- product, by somebody who knows the terms exist.
--
-- The importer does NOT write this column. That is the same rule `status`
-- follows and for the same reason: a re-import to pick up a copy edit must not
-- silently revoke an offer an administrator has enabled.

BEGIN;

ALTER TABLE products
  ADD COLUMN emi_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN products.emi_enabled IS
  'Whether this product is advertised with no-cost EMI. Defaults to false and '
  'is never written by the importer: enabling it asserts specific financing '
  'terms, so it is only ever an explicit decision in the admin console.';

COMMIT;
