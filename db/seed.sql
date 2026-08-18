-- Demo data for the local test database.
--
-- Enough orders in enough states to review the admin console without placing
-- them by hand. Every row is marked `is_test = true`, and the customer details
-- are obviously synthetic: no real person's name, number or address appears.
--
-- Safe to re-run: it clears its own rows first.

BEGIN;

DELETE FROM orders WHERE order_number LIKE 'ITG-SEED-%';

-- 1. Cash on delivery, confirmed and awaiting dispatch.
WITH new_order AS (
  INSERT INTO orders (
    order_number, status, payment_status,
    customer_name, customer_phone, customer_email, shipping_address,
    subtotal, product_savings, shipping, cod_fee, total, gst_amount,
    payment_method, is_test, place_of_supply
  ) VALUES (
    'ITG-SEED-000001', 'confirmed', 'pending',
    'Demo Buyer One', '9000000001', 'demo1@example.invalid',
    '{"line1":"1 Demo Street","city":"Pune","state":"Maharashtra","pincode":"411001"}'::jsonb,
    850000, 249900, 0, 0, 850000, 129661,
    'cod', true, '27'
  ) RETURNING id
)
INSERT INTO order_items (
  order_id, product_id, variant_id, sku, title, unit_mrp, unit_price,
  quantity, line_total, installation_included
)
SELECT id, 'itg-combo-900-live', 'seed-variant-900', 'ITG-INV-900VA-150AH',
       'iTarang Home Inverter 900VA', 1099900, 850000, 1, 850000, true
  FROM new_order;

-- 2. Paid by test payment, packed.
WITH new_order AS (
  INSERT INTO orders (
    order_number, status, payment_status,
    customer_name, customer_phone, shipping_address,
    subtotal, product_savings, shipping, total, gst_amount,
    payment_method, is_test, gateway_order_id, place_of_supply
  ) VALUES (
    'ITG-SEED-000002', 'packed', 'paid',
    'Demo Buyer Two', '9000000002',
    '{"line1":"2 Demo Road","city":"Jaipur","state":"Rajasthan","pincode":"302001"}'::jsonb,
    1329900, 319100, 0, 1329900, 202866,
    'mock', true, 'mock_order_seed000002', '08'
  ) RETURNING id
)
INSERT INTO order_items (
  order_id, product_id, variant_id, sku, title, unit_mrp, unit_price,
  quantity, line_total, installation_included
)
SELECT id, 'itg-bat-tall-150', 'seed-variant-tt150', 'ITG-BAT-TT-150',
       'iTarang TallTube 150', 1649000, 1329900, 1, 1329900, true
  FROM new_order;

-- 3. Awaiting payment — the abandoned-checkout case, with a live reservation.
WITH new_order AS (
  INSERT INTO orders (
    order_number, status, payment_status,
    customer_name, customer_phone, shipping_address,
    subtotal, shipping, total, gst_amount,
    payment_method, is_test, gateway_order_id, place_of_supply
  ) VALUES (
    'ITG-SEED-000003', 'pending_payment', 'pending',
    'Demo Buyer Three', '9000000003',
    '{"line1":"3 Demo Lane","city":"Kochi","state":"Kerala","pincode":"682001"}'::jsonb,
    674900, 39900, 714800, 109037,
    'mock', true, 'mock_order_seed000003', '32'
  ) RETURNING id
), item AS (
  INSERT INTO order_items (
    order_id, product_id, variant_id, sku, title, unit_mrp, unit_price,
    quantity, line_total, installation_included
  )
  SELECT id, 'itg-inv-pro-900', 'seed-variant-inv900', 'ITG-INV-900',
         'iTarang Sine Pro 900', 899000, 674900, 1, 674900, true
    FROM new_order
  RETURNING order_id
)
INSERT INTO stock_reservations (variant_id, order_id, quantity, state, expires_at)
SELECT 'seed-variant-inv900', order_id, 1, 'active', now() + interval '15 minutes' FROM item;

-- 4. Delivered, so the full timeline has something to show.
WITH new_order AS (
  INSERT INTO orders (
    order_number, status, payment_status,
    customer_name, customer_phone, shipping_address,
    subtotal, shipping, total, gst_amount,
    payment_method, is_test, place_of_supply
  ) VALUES (
    'ITG-SEED-000004', 'delivered', 'paid',
    'Demo Buyer Four', '9000000004',
    '{"line1":"4 Demo Avenue","city":"Lucknow","state":"Uttar Pradesh","pincode":"226001"}'::jsonb,
    439900, 0, 439900, 67103,
    'cod', true, '09'
  ) RETURNING id
), item AS (
  INSERT INTO order_items (
    order_id, product_id, variant_id, sku, title, unit_mrp, unit_price,
    quantity, line_total, installation_included
  )
  SELECT id, 'itg-bat-smf-42', 'seed-variant-smf42', 'ITG-BAT-SMF-42',
         'iTarang SealPro 42', 549000, 439900, 1, 439900, false
    FROM new_order
  RETURNING order_id
)
INSERT INTO order_events (order_id, from_status, to_status, actor, note)
SELECT order_id, 'confirmed', 'delivered', 'seed', 'Seeded as a completed order' FROM item;

-- Baselines so the reconciliation view and availability checks have something
-- to work against.
INSERT INTO inventory_baseline (variant_id, hostinger_quantity) VALUES
  ('seed-variant-900',    25),
  ('seed-variant-tt150',  38),
  ('seed-variant-inv900', 46),
  ('seed-variant-smf42',  44)
ON CONFLICT (variant_id) DO UPDATE SET hostinger_quantity = EXCLUDED.hostinger_quantity;

COMMIT;
