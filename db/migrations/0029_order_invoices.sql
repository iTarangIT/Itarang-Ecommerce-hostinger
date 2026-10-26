-- Order invoices: the PDF an admin uploads once an order is paid, and a record
-- of when it was emailed to the customer.
--
-- One current invoice per order. Uploading again replaces the file and clears
-- the emailed fields, because the customer has not yet been sent the new one.
--
-- The PDF is kept in the database rather than in the public product-media
-- bucket: an invoice carries the buyer's name, address and GSTIN, and must
-- never be reachable by URL. Files are capped at 8 MB by the upload route.
--
-- Rollback:
--   DROP TABLE order_invoices;

BEGIN;

CREATE TABLE order_invoices (
  order_id     bigint PRIMARY KEY REFERENCES orders (id) ON DELETE CASCADE,
  file_name    text        NOT NULL,
  size_bytes   integer     NOT NULL CHECK (size_bytes > 0),
  content      bytea       NOT NULL,
  uploaded_by  text        NOT NULL,
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  emailed_to   text,
  emailed_by   text,
  emailed_at   timestamptz
);

COMMENT ON TABLE order_invoices IS 'Invoice PDF uploaded by an admin for a paid order, and when it was emailed.';

COMMIT;
