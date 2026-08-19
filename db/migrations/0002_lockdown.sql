-- Lock the checkout tables away from the provider's auto-generated REST API.
--
-- A managed PostgreSQL provider such as Supabase publishes every table in the
-- `public` schema through PostgREST, reachable with the project's anon key —
-- a key that is public by design and ships in browser JavaScript. These tables
-- hold customer names, phone numbers, e-mail addresses and shipping addresses.
-- Without this migration, that data is world-readable and world-writable.
--
-- Two independent defences, because either one alone is a single point of
-- failure: row-level security with no policies (nothing matches, so nothing is
-- visible) and revoked table grants (the roles cannot reach the tables at all).
--
-- ENABLE, deliberately not FORCE. The application connects as the table owner,
-- and RLS does not apply to the owner unless FORCE is used. FORCE here would
-- lock the application out of its own database and break every checkout.
--
-- This migration is a no-op on a local PostgreSQL, which has neither the roles
-- nor the REST API — the role checks below make it safe to run there too.

BEGIN;

-- ------------------------------------------------------ row-level security

ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations  ENABLE ROW LEVEL SECURITY;

-- No policies are created. An empty policy set denies every row to every role
-- that RLS applies to, which is precisely the intent: this schema is reached
-- only by the application's own connection, never by an API client.

-- --------------------------------------------------------------- privileges

-- `anon` and `authenticated` are the provider's REST roles and do not exist on
-- a plain local PostgreSQL, so every statement is guarded on their presence.
--
-- `service_role` is left alone: it is a server-side secret, never shipped to a
-- browser, and revoking it would remove the operator's own break-glass access
-- through the provider's dashboard.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated';
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM anon, authenticated';

    -- Tables added by a future migration inherit the same treatment, so this
    -- does not have to be remembered every time the schema grows.
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
         || 'REVOKE ALL ON TABLES FROM anon, authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
         || 'REVOKE ALL ON SEQUENCES FROM anon, authenticated';

  END IF;
END
$$;

COMMIT;
