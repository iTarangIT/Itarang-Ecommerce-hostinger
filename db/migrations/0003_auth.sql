-- Customer and admin identity.
--
-- Until now the application had no notion of a person: an order carried a name,
-- a phone number and an address, and nothing tied two orders together. This
-- adds accounts, sessions and the link from an order to its owner.
--
-- Passwords are never stored — only a scrypt hash, in the same
-- `scrypt.<salt>.<hash>` format `src/lib/admin/password.ts` already produces.
--
-- Session and email tokens are stored as SHA-256 digests, never as the value
-- handed to the browser or put in a link. A leaked database therefore yields no
-- usable session and no usable reset link.
--
-- `orders.user_id` is deliberately NULLABLE. Guest orders placed before
-- accounts existed must remain valid and readable exactly as they are; they are
-- never rewritten and never auto-claimed by a new account. New orders require a
-- signed-in customer, which is enforced in the application layer
-- (`placeOrder`), not by a NOT NULL constraint that would invalidate history.

BEGIN;

-- ---------------------------------------------------------------- users

CREATE TABLE users (
  id                    bigserial PRIMARY KEY,

  -- Stored lowercased; the application normalises before writing or looking up,
  -- so this unique index is the real guarantee that one address is one account.
  email                 text NOT NULL UNIQUE,
  password_hash         text NOT NULL,

  role                  text NOT NULL DEFAULT 'customer'
                          CHECK (role IN ('customer', 'admin')),

  full_name             text,
  phone                 text,

  -- Null until the address is proven. An unverified account may still shop —
  -- verification gates nothing in this phase, it only records the fact.
  email_verified_at     timestamptz,

  -- Set on accounts created by the bootstrap CLI, so a known starting password
  -- cannot survive first contact with a human.
  must_change_password  boolean NOT NULL DEFAULT false,

  -- Brute-force braking. Reset on any successful sign-in.
  failed_login_count    integer NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until          timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX users_role_idx ON users (role);

CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------- sessions

-- Opaque server-side sessions rather than a signed stateless cookie, so that
-- signing out, changing a password or locking an account revokes access
-- immediately instead of at the next expiry.
CREATE TABLE sessions (
  id            bigserial PRIMARY KEY,

  -- SHA-256 of the token in the cookie. The token itself is never stored.
  token_hash    text NOT NULL UNIQUE,

  user_id       bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),

  -- Recorded for the account's own "where you're signed in" view and for
  -- incident review. Never used as an authentication factor: both are
  -- client-controlled strings.
  user_agent    text,
  ip            text
);

CREATE INDEX sessions_user_idx    ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- ---------------------------------------------------------- user tokens

-- Single-use, short-lived tokens delivered by email. Same discipline as
-- sessions: the digest is stored, the token travels in the link.
CREATE TABLE user_tokens (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  purpose     text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash  text NOT NULL UNIQUE,

  expires_at  timestamptz NOT NULL,
  -- Stamped on redemption. A token with a non-null used_at is spent, even if
  -- it has not yet expired.
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_tokens_user_purpose_idx ON user_tokens (user_id, purpose);
CREATE INDEX user_tokens_expires_idx      ON user_tokens (expires_at);

-- ------------------------------------------------------- order ownership

-- ON DELETE SET NULL, never CASCADE: deleting a person must not delete the
-- financial record of what they bought.
ALTER TABLE orders
  ADD COLUMN user_id bigint REFERENCES users (id) ON DELETE SET NULL;

CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);

-- ------------------------------------------------------------- lockdown

-- Same treatment 0002 gave the checkout tables: row-level security with no
-- policies, so the provider's auto-generated REST API cannot reach any of this
-- with a public key. ENABLE, never FORCE — the application connects as the
-- table owner and must remain exempt.
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    EXECUTE 'REVOKE ALL ON users, sessions, user_tokens FROM anon, authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated';

  END IF;
END
$$;

COMMIT;
