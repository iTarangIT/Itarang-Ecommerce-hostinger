/**
 * Local database management for iTarang checkout testing.
 *
 *   node --env-file-if-exists=.env.local scripts/db.mts <command>
 *
 * Commands: status · create · migrate · seed · reset · sweep
 *
 * Every command calls the application's own `assertLocalDatabase` guard before
 * opening a connection — the same code path the server uses, not a copy — so a
 * misconfigured DATABASE_URL aborts before a single statement is issued.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  EXPECTED_DATABASE,
  assertLocalDatabase,
  inspectDatabaseUrl,
} from '../src/lib/db/guard.ts';

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

/** Guarded connection to the project database. */
async function connect() {
  const info = assertLocalDatabase(process.env.DATABASE_URL);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return { client, info };
}

/**
 * Maintenance connection, used by `create` only.
 *
 * Creating a database requires connecting to a database that already exists, so
 * this is the one deliberate exception to "only ever connect to itarang_dev".
 * It is narrow by construction: the target is validated first, the host is
 * forced to the same local host, and the only statement ever issued is
 * `CREATE DATABASE itarang_dev`.
 */
async function connectMaintenance() {
  const info = assertLocalDatabase(process.env.DATABASE_URL);
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  return { client, info };
}

/* ------------------------------------------------------------- commands */

async function status() {
  const info = inspectDatabaseUrl(process.env.DATABASE_URL ?? '');
  console.log(`\n  target      ${info.redacted}`);
  console.log(`  expected    ${EXPECTED_DATABASE} on a local host`);

  try {
    assertLocalDatabase(process.env.DATABASE_URL);
    console.log('  guard       PASS');
  } catch (error) {
    console.log(`  guard       REFUSED — ${(error as Error).message}`);
    process.exit(1);
  }

  const { client } = await connect();
  try {
    const { rows } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name`,
    );
    console.log(`  connection  OK`);
    console.log(`  tables      ${rows.length ? rows.map((r) => r.table_name).join(', ') : '(none)'}`);

    const applied = await appliedMigrations(client).catch(() => []);
    console.log(`  migrations  ${applied.length ? applied.join(', ') : '(none applied)'}\n`);
  } finally {
    await client.end();
  }
}

async function create() {
  const info = assertLocalDatabase(process.env.DATABASE_URL);
  console.log(`\n  Creating database "${info.database}" on ${info.host}:${info.port}`);

  const { client } = await connectMaintenance();
  try {
    const { rows } = await client.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [info.database],
    );
    if (rows[0]?.exists) {
      console.log(`  ✓ "${info.database}" already exists — nothing to do\n`);
      return;
    }
    // Identifier cannot be parameterised; it is validated by the guard above
    // and matched against a strict pattern here as a second check.
    if (!/^[a-z][a-z0-9_]{2,62}$/.test(info.database)) {
      fail(`Refusing to create a database with an unexpected name: "${info.database}"`);
    }
    await client.query(`CREATE DATABASE ${info.database}`);
    console.log(`  ✓ created "${info.database}"\n`);
  } finally {
    await client.end();
  }
}

async function appliedMigrations(client: pg.Client): Promise<string[]> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  const { rows } = await client.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY name',
  );
  return rows.map((r) => r.name);
}

async function migrate() {
  const { client, info } = await connect();
  console.log(`\n  Migrating ${info.redacted}`);
  try {
    const applied = new Set(await appliedMigrations(client));
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`    · ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      console.log(`    ✓ ${file}`);
      ran += 1;
    }
    console.log(ran === 0 ? '  Nothing to do\n' : `  Applied ${ran} migration(s)\n`);
  } finally {
    await client.end();
  }
}

async function seed() {
  const { client, info } = await connect();
  console.log(`\n  Seeding ${info.redacted}`);
  try {
    const sql = readFileSync(join(ROOT, 'db', 'seed.sql'), 'utf8');
    await client.query(sql);
    const { rows } = await client.query<{ count: string }>('SELECT count(*) FROM orders');
    console.log(`  ✓ seeded — ${rows[0]?.count} order(s) in the database\n`);
  } finally {
    await client.end();
  }
}

async function reset() {
  const { client, info } = await connect();
  console.log(`\n  Resetting ${info.redacted}`);
  try {
    // Drops only this project's schema objects, inside the guarded database.
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('    ✓ schema dropped and recreated');
  } finally {
    await client.end();
  }
  await migrate();
  await seed();
}

async function sweep() {
  const { client, info } = await connect();
  console.log(`\n  Sweeping expired reservations in ${info.redacted}`);
  try {
    const { rowCount } = await client.query(
      `UPDATE stock_reservations
          SET state = 'expired'
        WHERE state = 'active' AND expires_at <= now()`,
    );
    // Tidiness only — availability queries already exclude expired rows.
    console.log(`  ✓ marked ${rowCount ?? 0} expired reservation(s)\n`);
  } finally {
    await client.end();
  }
}

/* ---------------------------------------------------------------- entry */

const COMMANDS: Record<string, () => Promise<void>> = {
  status,
  create,
  migrate,
  seed,
  reset,
  sweep,
};

const command = process.argv[2];

if (!command || !COMMANDS[command]) {
  console.error(`\n  Usage: npm run db:<command>\n  Commands: ${Object.keys(COMMANDS).join(' · ')}\n`);
  process.exit(1);
}

try {
  await COMMANDS[command]();
} catch (error) {
  const message = (error as Error).message;
  // The guard's messages are already password-free; this is a belt-and-braces
  // check so a driver-level error can never leak a credential.
  fail(message.replace(/:\/\/[^@]*@/, '://***@'));
}
