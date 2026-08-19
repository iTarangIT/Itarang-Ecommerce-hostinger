/**
 * Create or promote an admin account.
 *
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create -- --allow-weak
 *
 * The password comes from the environment, never from argv: an argument is
 * visible in shell history and in the process list to every other user on the
 * machine. It is read once, hashed, and never printed.
 *
 * Accounts created here are flagged `must_change_password`, so the password
 * typed into a terminal cannot survive first sign-in — `admin/layout.tsx`
 * refuses to show the console until it has been replaced.
 *
 * `--allow-weak` exists for demo and test environments that need a specific
 * known password. It is the only way past the policy, it has to be typed on
 * purpose, and it prints a warning.
 */
import pg from 'pg';
import { connectionOptions } from '../src/lib/db/connection.ts';
import { hashPassword } from '../src/lib/admin/password.ts';
import { passwordProblem } from '../src/lib/auth/password-policy.ts';

const { Client } = pg;

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const allowWeak = process.argv.includes('--allow-weak');

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  fail('Set ADMIN_EMAIL to a valid email address.');
}
if (!password) {
  fail('Set ADMIN_PASSWORD. It is read from the environment so it never reaches shell history.');
}

const problem = passwordProblem(password);
if (problem && !allowWeak) {
  fail(`${problem}\n    Pass --allow-weak to override for a demo or test environment.`);
}
if (problem && allowWeak) {
  console.warn(
    `\n  ! Weak password accepted because --allow-weak was given: ${problem}` +
      '\n    The account is flagged to force a change at first sign-in.' +
      '\n    Do not do this in production.',
  );
}

const { info, connectionString, ssl } = connectionOptions();
const client = new Client({ connectionString, ssl });
await client.connect();

try {
  console.log(`\n  Target: ${info.redacted} (${info.remote ? 'remote' : 'local'})`);

  // Idempotent: re-running with a new password rotates it and re-flags the
  // account, which is also the recovery path when an admin is locked out.
  const { rows } = await client.query<{ id: number; created: boolean }>(
    `INSERT INTO users (email, password_hash, role, must_change_password, full_name)
     VALUES ($1, $2, 'admin', true, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'admin',
           must_change_password = true,
           failed_login_count = 0,
           locked_until = NULL
     RETURNING id, (xmax = 0) AS created`,
    [email, hashPassword(password), process.env.ADMIN_NAME?.trim() || null],
  );

  const row = rows[0]!;

  // Rotating the password must not leave old sessions alive.
  const revoked = await client.query('DELETE FROM sessions WHERE user_id = $1', [row.id]);

  console.log(`  ✓ ${row.created ? 'created' : 'updated'} admin ${email} (id ${row.id})`);
  if ((revoked.rowCount ?? 0) > 0) {
    console.log(`  ✓ revoked ${revoked.rowCount} existing session(s)`);
  }
  console.log('\n  Sign in at /login. You will be asked to choose a new password.\n');
} finally {
  await client.end();
}
