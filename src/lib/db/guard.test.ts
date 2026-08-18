import { describe, expect, it } from 'vitest';
import {
  DatabaseGuardError,
  EXPECTED_DATABASE,
  assertLocalDatabase,
  inspectDatabaseUrl,
  isLocalDatabaseUrl,
} from './guard';

const LOCAL = `postgresql://itarang:secret@127.0.0.1:5432/${EXPECTED_DATABASE}`;

describe('assertLocalDatabase — accepts', () => {
  it('the project database on 127.0.0.1', () => {
    expect(assertLocalDatabase(LOCAL).database).toBe('itarang_dev');
  });

  it('localhost and ::1 as equivalent local hosts', () => {
    expect(isLocalDatabaseUrl(`postgresql://u:p@localhost:5432/${EXPECTED_DATABASE}`)).toBe(true);
    expect(isLocalDatabaseUrl(`postgresql://u:p@[::1]:5432/${EXPECTED_DATABASE}`)).toBe(true);
  });

  it('the postgres:// and postgresql:// schemes, and a non-default port', () => {
    expect(isLocalDatabaseUrl(`postgres://u:p@127.0.0.1:5433/${EXPECTED_DATABASE}`)).toBe(true);
  });
});

describe('assertLocalDatabase — refuses', () => {
  it('a missing URL', () => {
    expect(() => assertLocalDatabase(undefined)).toThrow(DatabaseGuardError);
  });

  it('any remote host', () => {
    for (const host of [
      'db.iqpmrluvlsgoihwyibey.supabase.co',
      'db.bimylkdbzfljqmwfkpwy.supabase.co',
      '10.0.0.5',
      'example.com',
    ]) {
      expect(() => assertLocalDatabase(`postgresql://u:p@${host}:5432/${EXPECTED_DATABASE}`)).toThrow(
        /local database only/,
      );
    }
  });

  it('tarang_dev by name — it belongs to another application', () => {
    expect(() => assertLocalDatabase('postgresql://u:p@127.0.0.1:5432/tarang_dev')).toThrow(
      /belongs to another application/,
    );
  });

  it('a name differing from ours only by the leading "i"', () => {
    // The whole reason the denylist exists: one keystroke apart.
    const wrong = 'postgresql://u:p@127.0.0.1:5432/tarang_dev';
    const right = `postgresql://u:p@127.0.0.1:5432/${EXPECTED_DATABASE}`;
    expect(isLocalDatabaseUrl(wrong)).toBe(false);
    expect(isLocalDatabaseUrl(right)).toBe(true);
  });

  it('system databases', () => {
    for (const database of ['postgres', 'template0', 'template1']) {
      expect(() => assertLocalDatabase(`postgresql://u:p@127.0.0.1:5432/${database}`)).toThrow(
        DatabaseGuardError,
      );
    }
  });

  it('any other local database', () => {
    expect(() => assertLocalDatabase('postgresql://u:p@127.0.0.1:5432/some_other_app')).toThrow(
      /expected database "itarang_dev"/,
    );
  });

  it('a non-postgres scheme', () => {
    expect(() => assertLocalDatabase('mysql://u:p@127.0.0.1:3306/itarang_dev')).toThrow(
      /postgres:\/\/ connection string/,
    );
  });

  it('an unparseable string', () => {
    expect(() => assertLocalDatabase('not a url')).toThrow(/not a valid connection string/);
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
      assertLocalDatabase('postgresql://itarang:secret@127.0.0.1:5432/tarang_dev');
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret');
    }
  });

  it('defaults the port when omitted', () => {
    expect(inspectDatabaseUrl(`postgresql://u:p@127.0.0.1/${EXPECTED_DATABASE}`).port).toBe('5432');
  });
});
