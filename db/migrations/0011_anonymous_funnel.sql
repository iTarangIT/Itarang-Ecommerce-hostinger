-- The login wall: the anonymous funnel's terminal stage.
--
-- /checkout calls `requireUser`, so an unregistered visitor can never reach
-- checkout, payment or an order while still anonymous. Every anonymous journey
-- that gets that far ends at the same place — bounced to /login — and until now
-- that ending was invisible. The gap between `add_to_cart` and `signed_in` was
-- the largest drop in the product and the funnel could only infer it.
--
-- `checkout_intent` records it directly. Like `begin_checkout` it is written
-- SERVER-side from /checkout, which is already force-dynamic, so it costs no
-- caching and a browser that never opened the page cannot forge one.
--
-- Nothing else changes. No new table, no new column, no new index: 0009 already
-- models anonymous identity correctly (visitor_id -> session_id -> events, with
-- visitor_identities for the account link and order_attribution for the order
-- link), and every query this stage feeds is served by indexes that already
-- exist. The privacy posture of 0009 is unchanged and still literally true —
-- no name, e-mail, phone, address, IP or user-agent is stored here.
--
-- ONE STATEMENT ONLY, deliberately. PostgreSQL permits ALTER TYPE ... ADD VALUE
-- inside a transaction block (and `scripts/db.mts` wraps every migration in
-- one), but the new value cannot be USED in that same transaction. Adding an
-- index, a CHECK or an INSERT that references 'checkout_intent' here would fail.
--
-- Enum values cannot be dropped. Rollback therefore means reverting the code and
-- leaving this value in place, unused and inert — see the plan's rollback note.
-- Deploy order is migration first, then code: `record()` swallows its errors, so
-- code that runs ahead of this migration would lose the stage silently.

BEGIN;

ALTER TYPE funnel_event ADD VALUE IF NOT EXISTS 'checkout_intent';

COMMIT;
