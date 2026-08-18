import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Password hashing for the admin console.
 *
 * Kept free of any Next.js import so the `admin:hash` script can use it
 * directly from Node without pulling in the framework.
 *
 * Format: `scrypt.<salt-hex>.<hash-hex>` — the password itself is never stored.
 *
 * The separator is a full stop, **not** the conventional `$`, and that matters:
 * this value lives in `.env.local`, and Next.js loads env files through
 * dotenv-expand, which treats `$name` as variable interpolation. A
 * `scrypt$salt$hash` value silently arrives in the application as just
 * `scrypt` — the salt and hash expanded to nothing — and every login fails
 * with no error anywhere. Hex digits and `.` are inert to every dotenv parser.
 *
 * `verifyPassword` still accepts the older `$` form so an existing stored hash
 * keeps working.
 */

const SEPARATOR = '.';
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return ['scrypt', salt.toString('hex'), derived.toString('hex')].join(SEPARATOR);
}

export function verifyPassword(password: string, stored: string): boolean {
  // Accept either separator: '.' is what we now emit, '$' is the legacy form.
  const parts = stored.includes(SEPARATOR) ? stored.split(SEPARATOR) : stored.split('$');
  const [scheme, saltHex, hashHex] = parts;

  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LENGTH) return false;

  const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

/**
 * True when a value can survive a dotenv round-trip unchanged.
 *
 * Used by the hashing script to refuse to emit anything that would be mangled
 * on the way back in.
 */
export function isEnvSafe(value: string): boolean {
  return !/[$`\\"'\s]/.test(value);
}
