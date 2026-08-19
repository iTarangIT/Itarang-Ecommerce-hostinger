/**
 * Database management for iTarang checkout.
 *
 *   node --env-file-if-exists=.env.local scripts/db.mts <command>
 *
 * Commands: status · create · migrate · seed · reset · sweep
 *
 * Every command goes through `connectionOptions()`, which calls the
 * application's own guard before opening a connection — the same code path the
 * server uses, not a copy — so a misconfigured DATABASE_URL aborts before a
 * single statement is issued, and TLS settings cannot drift from the app's.
 *
 * The destructive commands (`create`, `seed`, `reset`) are local-only. A
 * managed database is not ours to drop, and `db:reset` in particular would
 * take Supabase's own objects in `public` with it. `DB_ALLOW_DESTRUCTIVE=true`
 * overrides `seed`/`reset` for the rare deliberate case.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { connectionOptions } from '../src/lib/db/connection.ts';
import { EXPECTED_DATABASE, inspectDatabaseUrl } from '../src/lib/db/guard.ts';

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations');

function fail(message: string): never {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

/** Guarded connection to the project database. */
async function connect() {
  const { info, connectionString, ssl } = connectionOptions();
  const client = new Client({ connectionString, ssl });
  await client.connect();
  return { client, info };
}

/**
 * Refuse a command that has no business running against a managed database.
 *
 * `override` names the escape hatch, when one exists at all; `create` has none,
 * because there is nothing sensible for it to do remotely.
 */
function refuseRemote(command: string, reason: string, override?: string): never {
  fail(
    `Refusing to run "${command}" against a remote database. ${reason}` +
      (override
        ? `\n    Set ${override}=true if this is genuinely what you want.`
        : ''),
  );
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
  const { info, connectionString } = connectionOptions();
  if (info.remote) {
    refuseRemote('create', 'A managed provider provisions the database for you.');
  }
  const url = new URL(connectionString);
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  return { client, info };
}

/* ------------------------------------------------------------- commands */

async function status() {
  const info = inspectDatabaseUrl(process.env.DATABASE_URL ?? '');
  console.log(`\n  target      ${info.redacted}`);
  console.log(`  expected    ${EXPECTED_DATABASE} on a local host, or the approved remote host`);

  let remote = false;
  try {
    remote = connectionOptions().info.remote;
    console.log(`  guard       PASS`);
    console.log(`  mode        ${remote ? 'remote (TLS required)' : 'local'}`);
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
  const { info } = connectionOptions();
  if (info.remote) {
    refuseRemote('create', 'A managed provider provisions the database for you.');
  }
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
  if (connectionOptions().info.remote && process.env.DB_ALLOW_DESTRUCTIVE !== 'true') {
    refuseRemote(
      'seed',
      'db/seed.sql deletes and rewrites the ITG-SEED-% demo orders.',
      'DB_ALLOW_DESTRUCTIVE',
    );
  }

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
  if (connectionOptions().info.remote && process.env.DB_ALLOW_DESTRUCTIVE !== 'true') {
    refuseRemote(
      'reset',
      'It drops the entire public schema, including objects the provider owns.',
      'DB_ALLOW_DESTRUCTIVE',
    );
  }

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
    console.log(`  ✓ marked ${rowCount ?? 0} expired reservation(s)`);

    // Not tidiness. A webhook event is claimed before it is applied and
    // stamped only after, so anything still unstamped some minutes later is a
    // payment update that never landed — the gateway believes it delivered.
    // These need a human, so the sweep reports them loudly rather than
    // retrying blindly.
    const { rows: stuck } = await client.query<{
      provider: string;
      event_id: string;
      event_type: string;
      received_at: Date;
    }>(
      `SELECT provider, event_id, event_type, received_at
         FROM webhook_events
        WHERE processed_at IS NULL
          AND received_at < now() - interval '15 minutes'
        ORDER BY received_at`,
    );

    // Rate-limit windows nobody will read again. Housekeeping only — expiry is
    // decided by the window in the key, not by this running.
    const { rowCount: limitsCleared } = await client.query(
      `DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`,
    );
    console.log(`  ✓ cleared ${limitsCleared ?? 0} expired rate-limit window(s)`);

    if (stuck.length === 0) {
      console.log('  ✓ no unprocessed webhook events\n');
    } else {
      console.log(`\n  ✗ ${stuck.length} webhook event(s) recorded but never applied:`);
      for (const row of stuck) {
        console.log(
          `      ${row.received_at.toISOString()}  ${row.provider}  ${row.event_type}  ${row.event_id}`,
        );
      }
      console.log('    Each one is a payment the gateway thinks it told us about.\n');
    }
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
