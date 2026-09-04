-- Customer identity: one-time sign-in codes, and phone as a real identifier.
--
-- Customers authenticate with a code emailed to them. Administrators keep the
-- existing email + password path, unchanged. That split is enforced in
-- `src/lib/auth/actions.ts` and `src/lib/auth/otp-actions.ts`, not here — this
-- migration only provides the storage it needs.
--
-- Every change below is additive. No existing column, constraint or type is
-- altered, which is what makes the rollback total rather than conditional:
--
--   DROP TABLE auth_otps;
--   DROP INDEX users_phone_key;
--
-- In particular `users.password_hash` stays NOT NULL. An account created by the
-- OTP flow is given an *unusable* password — a scrypt hash of a freshly minted
-- 32-byte token that is hashed and immediately discarded — rather than the
-- column being made nullable. Two reasons, and the first is the load-bearing
-- one:
--
--   1. Making it nullable widens `UserRow.password_hash` to `string | null`,
--      which forces a change to how `loginAction` calls `verifyPassword`. That
--      is the administrator sign-in path, and it must keep working exactly as
--      it does today.
--   2. Nobody, ourselves included, holds a value that verifies against a
--      discarded random token, so the sentinel is not a credential. It is a
--      value that satisfies a NOT NULL constraint and authenticates no one.

BEGIN;

-- ---------------------------------------------------------------- phone

-- Phone becomes an identifier rather than a display field.
--
-- Free to add today (no row has a phone set) and expensive later, once numbers
-- have been backfilled from order records and duplicates exist. Partial, so the
-- many rows with no phone do not collide with each other.
--
-- Nothing in this release logs in by phone: mobile OTP needs an SMS provider
-- and Indian DLT registration, neither of which exists. The index is here so
-- that when it does, the constraint is already true of the data.
CREATE UNIQUE INDEX users_phone_key ON users (phone) WHERE phone IS NOT NULL;

-- ------------------------------------------------------------ sign-in codes

-- Why this is not `user_tokens`.
--
-- The existing token table carries verify-email and reset-password links, and
-- four of its properties make it wrong for a 6-digit code:
--
--   1. `token_hash` is UNIQUE. Two customers holding the same live code — a one
--      in a million event that happens — would collide on the index.
--   2. `redeemToken` looks up by hash alone, unscoped to a user. A short code
--      must be scoped to the identifier it was sent to, or a code mailed to one
--      person unlocks whoever else happens to hold it.
--   3. `purpose` has a CHECK listing only the two existing kinds.
--   4. Decisive: `user_tokens.user_id` is NOT NULL. A code has to be issuable
--      *before* we admit whether an account exists, or the response itself
--      reveals it. Keying on the identifier instead is what makes the
--      anti-enumeration answer possible.
CREATE TABLE auth_otps (
  id              bigserial PRIMARY KEY,

  -- NULL until the code is proved. A challenge is issued for an address whether
  -- or not it has an account, and the account is created on success. Where a
  -- user does exist the id is recorded, so that consuming a code can act on the
  -- right row without a second lookup racing the first.
  user_id         bigint REFERENCES users (id) ON DELETE CASCADE,

  -- The normalised address the code was sent to. Lower-cased for email by
  -- `normaliseEmail`; E.164 later, for phone.
  identifier      text NOT NULL,
  identifier_kind text NOT NULL CHECK (identifier_kind IN ('email', 'phone')),
  channel         text NOT NULL CHECK (channel IN ('email', 'sms')),

  -- Salt and pepper, and they solve different problems.
  --
  -- The pepper (AUTH_OTP_PEPPER, held outside the database) turns a leaked dump
  -- from a 10^6 search into an infeasible one — which unsalted SHA-256, as used
  -- by `hashToken`, cannot do for a six-digit secret.
  --
  -- The per-row salt means two people who both draw 123456 store different
  -- digests. That is exactly why `code_hash` carries NO unique index, and why a
  -- stolen dump cannot be sorted to find which accounts share a code.
  salt            text NOT NULL,
  code_hash       text NOT NULL,

  -- Counted in the row rather than by the rate limiter, because the limiter
  -- fails open on a database error and this cap must not.
  attempts        integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts    integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),

  expires_at      timestamptz NOT NULL,

  -- Three distinct endings, deliberately not collapsed into one column:
  --   consumed_at    — spent successfully
  --   invalidated_at — superseded by a resend, or burned out on attempts
  --   (neither)      — live, or simply expired
  consumed_at     timestamptz,
  invalidated_at  timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Recorded for review only. Never trusted as an authentication factor: a
  -- client sets its own forwarded-for header.
  ip              text,
  user_agent      text
);

-- The lookup the verify path makes: newest live code for one identifier.
CREATE INDEX auth_otps_identifier_idx ON auth_otps (identifier, created_at DESC);

-- For the sweeper.
CREATE INDEX auth_otps_expires_idx ON auth_otps (expires_at);

-- This is the most sensitive table in the schema: reading it is reading live
-- sign-in codes. 0002 already revoked the anon and authenticated roles from the
-- whole schema and set default privileges so new tables inherit that, but this
-- one is stated explicitly rather than inherited silently.
ALTER TABLE auth_otps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON auth_otps FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON SEQUENCE auth_otps_id_seq FROM anon, authenticated';
  END IF;
END
$$;

COMMIT;
