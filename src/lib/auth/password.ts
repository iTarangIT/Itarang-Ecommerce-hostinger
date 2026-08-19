export { hashPassword, verifyPassword, isEnvSafe } from '@/lib/admin/password';
export {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  passwordProblem,
} from './password-policy';

/**
 * Server-side password surface: hashing plus the policy rules.
 *
 * The hashing itself is not reimplemented — `src/lib/admin/password.ts` already
 * provides scrypt with a per-password salt and a timing-safe compare, and is
 * covered by its own tests.
 *
 * **Client components must import `./password-policy` directly, not this
 * module.** This one re-exports the scrypt functions, and pulling it into a
 * client bundle drags in `node:crypto` and breaks the build.
 */
