-- "Connect with an iTarang expert" popup shown to first-time visitors.
--
--   support_requests.kind gains 'callback': name, mobile and pincode from the
--   popup, with the visitor's consent to be called kept in `details`.
--
-- Rollback:
--   DELETE FROM support_requests WHERE kind = 'callback';
--   ALTER TABLE support_requests DROP CONSTRAINT support_requests_kind_check,
--     ADD CONSTRAINT support_requests_kind_check
--     CHECK (kind IN ('complaint', 'warranty', 'installation', 'enquiry'));

BEGIN;

ALTER TABLE support_requests DROP CONSTRAINT support_requests_kind_check;
ALTER TABLE support_requests ADD CONSTRAINT support_requests_kind_check
  CHECK (kind IN ('complaint', 'warranty', 'installation', 'enquiry', 'callback'));

COMMIT;
