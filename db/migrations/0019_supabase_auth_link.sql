-- Links an account to its Supabase Auth identity.
--
-- Sign-in is moving to Supabase Auth (`auth.users` in the same project), while
-- `users` stays the profile every order, address, wishlist and notification
-- request points at. `auth_user_id` is the join between the two: Supabase
-- answers "who proved this email", this table answers "which customer is that".
--
-- Nullable and unique. NULL is every existing account until it first signs in
-- through Supabase and is linked; unique because one identity is one customer.
-- No backfill: linking happens at sign-in, after Supabase has confirmed the
-- address, never by guessing from this table.
--
-- The foreign key to `auth.users` is added only where that schema exists. A
-- local `itarang_dev` and the CI database are plain PostgreSQL with no `auth`
-- schema, and the column works the same without the constraint there. On
-- Supabase it makes deleting an identity unlink the profile rather than leave
-- it pointing at nothing. If the connecting role may not reference
-- `auth.users`, the column is kept and the constraint skipped with a notice —
-- the application never relies on it for correctness.
--
-- Rollback:
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_user_id_fkey;
--   ALTER TABLE users DROP COLUMN auth_user_id;

BEGIN;

ALTER TABLE users
  ADD COLUMN auth_user_id uuid UNIQUE;

COMMENT ON COLUMN users.auth_user_id IS
  'Supabase Auth identity (auth.users.id) this account signs in as. NULL until first linked at sign-in.';

DO $$
BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    BEGIN
      ALTER TABLE users
        ADD CONSTRAINT users_auth_user_id_fkey
        FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'auth.users is not referenceable by this role; users.auth_user_id kept without a foreign key';
    END;
  END IF;
END $$;

COMMIT;
