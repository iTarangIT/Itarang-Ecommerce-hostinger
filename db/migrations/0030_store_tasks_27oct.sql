-- Store tasks from the 27 Oct tracker.
--
--   R-08  order_invoices.invoice_number / invoice_date — invoices are raised in
--         Zoho or Vyapaar (D-06) and uploaded here; the number and date are what
--         the customer and the accounts team quote back.
--   R-05  orders.terms_accepted_at — when the shopper ticked "I agree to the
--         Terms and Privacy Policy and to order updates". NULL on every order
--         placed before the tick existed.
--   R-06  support_requests.kind gains 'enquiry', for "Send an enquiry" from the
--         load calculator.
--
-- Rollback:
--   ALTER TABLE order_invoices DROP COLUMN invoice_number, DROP COLUMN invoice_date;
--   ALTER TABLE orders DROP COLUMN terms_accepted_at;
--   DELETE FROM support_requests WHERE kind = 'enquiry';
--   ALTER TABLE support_requests DROP CONSTRAINT support_requests_kind_check,
--     ADD CONSTRAINT support_requests_kind_check
--     CHECK (kind IN ('complaint', 'warranty', 'installation'));

BEGIN;

ALTER TABLE order_invoices
  ADD COLUMN invoice_number text CHECK (invoice_number IS NULL OR length(invoice_number) BETWEEN 1 AND 60),
  ADD COLUMN invoice_date   date;

COMMENT ON COLUMN order_invoices.invoice_number IS 'Number printed on the Zoho/Vyapaar invoice (D-06).';

ALTER TABLE orders ADD COLUMN terms_accepted_at timestamptz;

COMMENT ON COLUMN orders.terms_accepted_at IS 'When the shopper accepted the Terms, Privacy Policy and order updates at checkout.';

ALTER TABLE support_requests DROP CONSTRAINT support_requests_kind_check;
ALTER TABLE support_requests ADD CONSTRAINT support_requests_kind_check
  CHECK (kind IN ('complaint', 'warranty', 'installation', 'enquiry'));

COMMIT;
