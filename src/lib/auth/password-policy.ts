/**
 * Password rules, with no crypto import.
 *
 * Deliberately separate from `password.ts`: the sign-up form is a client
 * component and needs `MIN_PASSWORD_LENGTH` to render its hint and its
 * `minLength` attribute. Importing that from the module that also re-exports
 * scrypt would drag `node:crypto` into the browser bundle, which fails the
 * build — correctly, since hashing has no business on the client.
 *
 * Length is the rule that actually matters. Composition requirements (a digit,
 * a symbol, mixed case) push people towards `Password1!` and are not applied.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

/**
 * A short list of the passwords that appear at the top of every breach corpus.
 *
 * Not a substitute for a real dictionary check — it is the cheap 90% that costs
 * nothing. Compared case-insensitively.
 */
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty',
  'qwertyuiop',
  'abc123',
  'letmein',
  'welcome',
  'welcome1',
  'admin',
  'admin123',
  'iloveyou',
  'monkey',
  'dragon',
  'football',
  'changeme',
  'passw0rd',
  'itarang',
  'itarang123',
]);

/**
 * Returns a human-readable problem with the password, or null when it is
 * acceptable. Returning the message rather than a boolean keeps the reason
 * available to the form without a second lookup.
 */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Use no more than ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return 'That password is one of the most commonly used ones. Please choose another.';
  }
  return null;
}
