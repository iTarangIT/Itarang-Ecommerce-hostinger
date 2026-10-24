-- SKUs are unique regardless of letter case.
--
-- `product_variants.sku` has been UNIQUE since 0012, but byte-for-byte: "TK-51100"
-- and "tk-51100" could both exist, and the bulk price sheet already matches
-- SKUs case-insensitively, so such a pair would make an upload ambiguous.
-- This index makes the database agree with the sheet. See
-- docs/product-rules.md for the full product identity rules.
--
-- If two variants already differ only by case, the migration stops with a
-- message naming them, rather than picking one to keep.
--
-- Rollback:
--   DROP INDEX product_variants_sku_upper_key;

BEGIN;

DO $$
DECLARE
  clash text;
BEGIN
  SELECT string_agg(sku, ', ') INTO clash
    FROM product_variants
   WHERE upper(sku) IN (
     SELECT upper(sku) FROM product_variants GROUP BY upper(sku) HAVING count(*) > 1
   );
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'SKUs differing only by letter case must be renamed first: %', clash;
  END IF;
END $$;

CREATE UNIQUE INDEX product_variants_sku_upper_key ON product_variants (upper(sku));

COMMIT;
