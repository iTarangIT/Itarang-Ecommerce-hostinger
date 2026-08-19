import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DatabaseGuardError,
  EXPECTED_DATABASE,
  assertProjectDatabase,
  inspectDatabaseUrl,
  isProjectDatabaseUrl,
} from './guard';

const LOCAL = `postgresql://itarang:secret@127.0.0.1:5432/${EXPECTED_DATABASE}`;

const REMOTE_HOST = 'aws-1-ap-south-1.pooler.supabase.com';
const REMOTE = `postgresql://postgres.abcdef:secret@${REMOTE_HOST}:5432/postgres?sslmode=require`;

/** Switch on the remote path the way .env.local does. */
function approveRemote(host = REMOTE_HOST) {
  vi.stubEnv('DB_ALLOW_REMOTE', 'true');
  vi.stubEnv('DB_REMOTE_HOST', host);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('assertProjectDatabase — local', () => {
  it('accepts the project database on 127.0.0.1, and reports it as local', () => {
    const info = assertProjectDatabase(LOCAL);
    expect(info.database).toBe('itarang_dev');
    expect(info.remote).toBe(false);
  });

  it('accepts localhost and ::1 as equivalent local hosts', () => {
    expect(isProjectDatabaseUrl(`postgresql://u:p@localhost:5432/${EXPECTED_DATABASE}`)).toBe(true);
    expect(isProjectDatabaseUrl(`postgresql://u:p@[::1]:5432/${EXPECTED_DATABASE}`)).toBe(true);
  });

  it('accepts the postgres:// and postgresql:// schemes, and a non-default port', () => {
    expect(isProjectDatabaseUrl(`postgres://u:p@127.0.0.1:5433/${EXPECTED_DATABASE}`)).toBe(true);
  });

  it('refuses any other local database', () => {
    expect(() => assertProjectDatabase('postgresql://u:p@127.0.0.1:5432/some_other_app')).toThrow(
      /expected database "itarang_dev"/,
    );
  });

  it('refuses the local maintenance database', () => {
    // `postgres` is a valid name remotely but never here.
    expect(() => assertProjectDatabase('postgresql://u:p@127.0.0.1:5432/postgres')).toThrow(
      /expected database "itarang_dev"/,
    );
  });

  it('is unaffected by the remote switches', () => {
    approveRemote();
    expect(assertProjectDatabase(LOCAL).remote).toBe(false);
  });
});

describe('assertProjectDatabase — remote', () => {
  // These stub the switches explicitly rather than relying on their absence:
  // vitest.setup.ts loads .env.local, which on a configured machine sets them.
  it('refuses a remote host when DB_ALLOW_REMOTE is not set', () => {
    vi.stubEnv('DB_ALLOW_REMOTE', '');
    vi.stubEnv('DB_REMOTE_HOST', REMOTE_HOST);
    expect(() => assertProjectDatabase(REMOTE)).toThrow(/DB_ALLOW_REMOTE is not set/);
  });

  it('refuses a remote host when DB_ALLOW_REMOTE is anything but "true"', () => {
    vi.stubEnv('DB_ALLOW_REMOTE', 'yes');
    vi.stubEnv('DB_REMOTE_HOST', REMOTE_HOST);
    expect(() => assertProjectDatabase(REMOTE)).toThrow(DatabaseGuardError);
  });

  it('refuses when DB_REMOTE_HOST is missing', () => {
    vi.stubEnv('DB_ALLOW_REMOTE', 'true');
    vi.stubEnv('DB_REMOTE_HOST', '');
    expect(() => assertProjectDatabase(REMOTE)).toThrow(/requires DB_REMOTE_HOST/);
  });

  it('refuses a host that is not the approved one — a typo still aborts', () => {
    approveRemote('aws-1-ap-south-1.pooler.supabase.com');
    const elsewhere = REMOTE.replace(REMOTE_HOST, 'aws-2-eu-west-1.pooler.supabase.com');
    expect(() => assertProjectDatabase(elsewhere)).toThrow(/approves only/);
  });

  it('refuses a database other than the approved one', () => {
    approveRemote();
    const wrongDb = `postgresql://u:p@${REMOTE_HOST}:5432/something_else?sslmode=require`;
    expect(() => assertProjectDatabase(wrongDb)).toThrow(/expected remote database "postgres"/);
  });

  it('honours DB_REMOTE_DATABASE when the provider names it differently', () => {
    approveRemote();
    vi.stubEnv('DB_REMOTE_DATABASE', 'itarang_prod');
    const named = `postgresql://u:p@${REMOTE_HOST}:5432/itarang_prod?sslmode=require`;
    expect(assertProjectDatabase(named).remote).toBe(true);
    expect(() => assertProjectDatabase(REMOTE)).toThrow(/expected remote database "itarang_prod"/);
  });

  it('refuses an unencrypted remote connection', () => {
    approveRemote();
    const plain = `postgresql://u:p@${REMOTE_HOST}:5432/postgres`;
    expect(() => assertProjectDatabase(plain)).toThrow(/sslmode=require/);

    const weaker = `postgresql://u:p@${REMOTE_HOST}:5432/postgres?sslmode=prefer`;
    expect(() => assertProjectDatabase(weaker)).toThrow(/sslmode=require/);
  });

  it('accepts the fully approved target and reports it as remote', () => {
    approveRemote();
    const info = assertProjectDatabase(REMOTE);
    expect(info.remote).toBe(true);
    expect(info.host).toBe(REMOTE_HOST);
    expect(info.database).toBe('postgres');
  });
});

describe('assertProjectDatabase — never valid anywhere', () => {
  it('refuses a missing URL', () => {
    expect(() => assertProjectDatabase(undefined)).toThrow(DatabaseGuardError);
  });

  it('refuses tarang_dev by name — it belongs to another application', () => {
    expect(() => assertProjectDatabase('postgresql://u:p@127.0.0.1:5432/tarang_dev')).toThrow(
      /belongs to another application/,
    );
  });

  it('refuses tarang_dev even on the approved remote host', () => {
    approveRemote();
    const url = `postgresql://u:p@${REMOTE_HOST}:5432/tarang_dev?sslmode=require`;
    expect(() => assertProjectDatabase(url)).toThrow(/belongs to another application/);
  });

  it('refuses a name differing from ours only by the leading "i"', () => {
    // The whole reason the denylist exists: one keystroke apart.
    const wrong = 'postgresql://u:p@127.0.0.1:5432/tarang_dev';
    const right = `postgresql://u:p@127.0.0.1:5432/${EXPECTED_DATABASE}`;
    expect(isProjectDatabaseUrl(wrong)).toBe(false);
    expect(isProjectDatabaseUrl(right)).toBe(true);
  });

  it('refuses template databases, locally and remotely', () => {
    approveRemote();
    for (const database of ['template0', 'template1']) {
      expect(() => assertProjectDatabase(`postgresql://u:p@127.0.0.1:5432/${database}`)).toThrow(
        DatabaseGuardError,
      );
      expect(() =>
        assertProjectDatabase(`postgresql://u:p@${REMOTE_HOST}:5432/${database}?sslmode=require`),
      ).toThrow(DatabaseGuardError);
    }
  });

  it('refuses a non-postgres scheme', () => {
    expect(() => assertProjectDatabase('mysql://u:p@127.0.0.1:3306/itarang_dev')).toThrow(
      /postgres:\/\/ connection string/,
    );
  });

  it('refuses an unparseable string', () => {
    expect(() => assertProjectDatabase('not a url')).toThrow(/not a valid connection string/);
  });
});

describe('inspectDatabaseUrl', () => {
  it('never exposes the password', () => {
    const info = inspectDatabaseUrl(LOCAL);
    expect(info.redacted).toBe('postgresql://itarang@127.0.0.1:5432/itarang_dev');
    expect(info.redacted).not.toContain('secret');
    expect(JSON.stringify(info)).not.toContain('secret');
  });

  it('keeps the password out of thrown error messages', () => {
    try {
      assertProjectDatabase('postgresql://itarang:secret@127.0.0.1:5432/tarang_dev');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret');
    }
  });

  it('keeps the password out of remote refusals too', () => {
    try {
      assertProjectDatabase(REMOTE);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret');
    }
  });

  it('defaults the port when omitted', () => {
    expect(inspectDatabaseUrl(`postgresql://u:p@127.0.0.1/${EXPECTED_DATABASE}`).port).toBe('5432');
  });
});
