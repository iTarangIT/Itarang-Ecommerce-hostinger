-- Storefront changes requested by the business ("Website changes", Oct 2026).
--
-- 1. The `lithium` subcategory is retired. Every battery on the site is
--    lithium, so the word described nothing; the Powercube home batteries it
--    held are home inverter batteries, which is what the business calls the
--    category. Products move to `home-inverter`; nothing else about them
--    changes.
--
-- 2. Orders gain `payment_discount`: the ₹200 off for paying by UPI. It is a
--    separate column rather than folded into `coupon_discount` because the two
--    are different promises — one comes from a code, one from how the order
--    was paid — and an invoice or a refund has to be able to tell them apart.
--    Zero for every existing order, which is the truth.
--
-- Rollback:
--   ALTER TABLE orders DROP COLUMN payment_discount;
--   UPDATE products SET subcategory = 'lithium'
--    WHERE category = 'batteries' AND subcategory = 'home-inverter';
--   (The second is only exact if no home-inverter product was added since.)

BEGIN;

UPDATE products
   SET subcategory = 'home-inverter'
 WHERE category = 'batteries'
   AND subcategory = 'lithium';

ALTER TABLE orders
  ADD COLUMN payment_discount bigint NOT NULL DEFAULT 0
    CHECK (payment_discount >= 0);

COMMENT ON COLUMN orders.payment_discount IS
  'Discount for the payment method chosen (₹200 for UPI), in paise. Separate from coupon_discount.';

COMMIT;
