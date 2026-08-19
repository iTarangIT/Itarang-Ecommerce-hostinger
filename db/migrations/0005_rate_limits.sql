-- Rate limiting.
--
-- Nothing in this application throttles anything today. The sharpest edge is
-- sign-in: unlimited password guesses, each costing the server a scrypt
-- derivation, which is both a credential attack and a cheap way to burn CPU.
-- The guest order lookup is the other one — order number plus a 10-digit phone
-- is brute-forceable given unlimited attempts.
--
-- Counters live in PostgreSQL rather than in process memory. The app runs as a
-- long-lived Node process on Hostinger, so memory would *work*, but it resets
-- on every deploy and restart — exactly when an attacker benefits most — and
-- silently stops being correct the day a second process appears. The database
-- is already a hard dependency of every request being limited.
--
-- Fixed windows, not sliding: one row per (bucket, window), incremented with a
-- single upsert. A burst can straddle a boundary and get up to 2x the quota,
-- which is an acceptable trade for one indexed write per attempt.

BEGIN;

CREATE TABLE rate_limits (
  -- Identifies what is being limited: 'login:someone@example.com',
  -- 'order-lookup:ip:1.2.3.4'. Composed by the caller, never by user input
  -- alone, so a crafted value cannot collide with somebody else's bucket.
  bucket        text NOT NULL,
  -- Start of the fixed window this row counts.
  window_start  timestamptz NOT NULL,
  count         integer NOT NULL DEFAULT 0 CHECK (count >= 0),

  PRIMARY KEY (bucket, window_start)
);

-- Old windows are dead weight; the sweep deletes them by age.
CREATE INDEX rate_limits_window_idx ON rate_limits (window_start);

-- ------------------------------------------------------------- lockdown

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON rate_limits FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
