import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load `.env.local` into `process.env` for the test run.
 *
 * Vitest does not read dotenv files itself, and without this the database
 * integration suite would skip silently on a machine that is perfectly capable
 * of running it — the worst kind of green build.
 *
 * Existing environment variables win, so `DATABASE_URL=… npm run test` still
 * overrides the file.
 */
const file = resolve(process.cwd(), '.env.local');

if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
