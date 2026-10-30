-- Store tasks from the 27 Oct tracker: product families, card EMI wording,
-- finance enquiries.
--
--   R-11  products.variant_group / variant_label — one product page per family
--         with a capacity dropdown (D-16). Each member stays its own product
--         with its own SKU, price and stock; the group is only what ties
--         "Powercube 1.4" and "Powercube 2.7" together, and the label is the
--         short text the dropdown shows ("1.4 kWh"). The label is stated, not
--         derived: the marketed capacity is not the arithmetic of the facets
--         (TK12100 is 12.8 V × 100 Ah = 1.28 kWh and is sold as "1.4").
--   R-16  products.emi_enabled is re-described. It no longer means a
--         lender-backed offer (D-07: there is no such agreement); it means
--         "show the card-EMI line", whose figure comes from Razorpay's plans.
--   R-15  support_requests.kind gains 'finance' ("Buy on finance"), and the
--         table gains where the CRM hand-off is recorded. The row is the copy
--         of record: it is written first, so an enquiry is never lost because
--         the CRM was down, and the crm_* columns say whether it got there.
--
-- Rollback:
--   DROP INDEX products_variant_group_idx;
--   ALTER TABLE products DROP COLUMN variant_group, DROP COLUMN variant_label;
--   DROP INDEX support_requests_crm_pending_idx;
--   ALTER TABLE support_requests DROP COLUMN crm_forwarded_at,
--     DROP COLUMN crm_lead_id, DROP COLUMN crm_last_error, DROP COLUMN crm_attempts;
--   DELETE FROM support_requests WHERE kind = 'finance';
--   ALTER TABLE support_requests DROP CONSTRAINT support_requests_kind_check,
--     ADD CONSTRAINT support_requests_kind_check
--     CHECK (kind IN ('complaint', 'warranty', 'installation', 'enquiry', 'callback'));

BEGIN;

ALTER TABLE products
  ADD COLUMN variant_group text CHECK (variant_group IS NULL OR variant_group ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  ADD COLUMN variant_label text CHECK (variant_label IS NULL OR length(variant_label) BETWEEN 1 AND 40);

CREATE INDEX products_variant_group_idx ON products (variant_group) WHERE variant_group IS NOT NULL;

COMMENT ON COLUMN products.variant_group IS
  'Family key (e.g. powercube): published products sharing it are offered on one page '
  'through a capacity dropdown (R-11, D-16). NULL means no family and no dropdown.';
COMMENT ON COLUMN products.variant_label IS
  'What this member is called in the family dropdown, e.g. "1.4 kWh". NULL falls back to the model name.';

COMMENT ON COLUMN products.emi_enabled IS
  'Whether the product page shows "Card EMI from ₹x a month". The figure comes from the '
  'live Razorpay EMI plans and the line is shown only when they are available; this is '
  'not a financing agreement and never claims one (D-07).';

ALTER TABLE support_requests DROP CONSTRAINT support_requests_kind_check;
ALTER TABLE support_requests ADD CONSTRAINT support_requests_kind_check
  CHECK (kind IN ('complaint', 'warranty', 'installation', 'enquiry', 'callback', 'finance'));

ALTER TABLE support_requests
  ADD COLUMN crm_forwarded_at timestamptz,
  ADD COLUMN crm_lead_id      text CHECK (crm_lead_id IS NULL OR length(crm_lead_id) <= 120),
  ADD COLUMN crm_last_error   text CHECK (crm_last_error IS NULL OR length(crm_last_error) <= 500),
  ADD COLUMN crm_attempts     integer NOT NULL DEFAULT 0 CHECK (crm_attempts >= 0);

-- Finance enquiries the CRM has not acknowledged, for the admin queue.
CREATE INDEX support_requests_crm_pending_idx ON support_requests (created_at DESC)
  WHERE kind = 'finance' AND crm_forwarded_at IS NULL;

COMMENT ON COLUMN support_requests.crm_forwarded_at IS 'When the CRM accepted this finance enquiry as a lead (R-15). NULL: not forwarded yet.';
COMMENT ON COLUMN support_requests.crm_lead_id IS 'The lead id the CRM returned.';
COMMENT ON COLUMN support_requests.crm_last_error IS 'Why the last forward failed, or that the CRM is not configured.';

COMMIT;
