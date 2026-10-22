-- Reviews, the parts that make them useful to a shopper.
--
--   product_review_votes  "Helpful" votes, one per account per review. The
--                         button used to count only in the voter's own browser
--                         and every review said "Helpful (0)" to everyone else.
--   admin_reply*          a public "Response from iTarang" under a review —
--                         the way to answer a complaint where other buyers see it.
--   updated_at            set when a customer edits their review; an edit goes
--                         back to `pending`, so nothing unchecked is shown.
--
-- Purely additive.
--
-- Rollback:
--   DROP TABLE product_review_votes;
--   ALTER TABLE product_reviews DROP COLUMN admin_reply, DROP COLUMN admin_reply_at,
--     DROP COLUMN admin_reply_by, DROP COLUMN updated_at;

BEGIN;

ALTER TABLE product_reviews
  ADD COLUMN admin_reply    text CHECK (admin_reply IS NULL OR length(admin_reply) BETWEEN 1 AND 2000),
  ADD COLUMN admin_reply_at timestamptz,
  ADD COLUMN admin_reply_by text,
  ADD COLUMN updated_at     timestamptz;

CREATE TABLE product_review_votes (
  review_id  bigint NOT NULL REFERENCES product_reviews (id) ON DELETE CASCADE,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

-- Lists a customer's own reviews on /account.
CREATE INDEX product_reviews_user_idx ON product_reviews (user_id, created_at DESC);

COMMIT;
