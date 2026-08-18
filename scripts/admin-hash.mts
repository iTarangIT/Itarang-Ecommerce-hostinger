/**
 * Generate ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET for .env.local.
 *
 *   npm run admin:hash -- "your password here"
 *
 * The password itself is never written anywhere — only the scrypt hash.
 */
import { randomBytes } from 'node:crypto';
import { hashPassword, isEnvSafe } from '../src/lib/admin/password.ts';

const password = process.argv[2];

if (!password || password.length < 8) {
  console.error('\n  Usage: npm run admin:hash -- "a password of at least 8 characters"\n');
  process.exit(1);
}

const hash = hashPassword(password);
const secret = randomBytes(32).toString('hex');

// Refuse to emit anything dotenv would mangle on the way back in. A `$` in the
// hash is expanded away by dotenv-expand, which silently breaks every login.
for (const [name, value] of [
  ['ADMIN_PASSWORD_HASH', hash],
  ['ADMIN_SESSION_SECRET', secret],
] as const) {
  if (!isEnvSafe(value)) {
    console.error(`\n  ✗ Generated ${name} contains a character dotenv would reinterpret.\n`);
    process.exit(1);
  }
}

console.log('\n  Add these to .env.local:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`ADMIN_SESSION_SECRET=${secret}`);
console.log('');
