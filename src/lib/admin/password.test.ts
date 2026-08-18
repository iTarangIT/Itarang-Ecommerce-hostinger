import { describe, expect, it } from 'vitest';
import { hashPassword, isEnvSafe, verifyPassword } from './password';

describe('password hashing', () => {
  it('verifies the password it hashed', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('correct horse battery staple');
    expect(verifyPassword('Correct horse battery staple', hash)).toBe(false);
    expect(verifyPassword('', hash)).toBe(false);
  });

  it('uses a fresh salt each time', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects malformed stored values', () => {
    for (const stored of ['', 'scrypt', 'scrypt.', 'scrypt.abc', 'bcrypt.a.b', 'nonsense']) {
      expect(verifyPassword('anything', stored)).toBe(false);
    }
  });
});

describe('the stored hash survives a dotenv round-trip', () => {
  /**
   * Regression guard for a real failure: the hash was previously
   * `scrypt$<salt>$<hash>`, and Next.js loads .env files through dotenv-expand,
   * which treated `$<salt>$<hash>` as variable interpolation. The application
   * received just `scrypt`, and every admin login failed silently.
   */
  it('contains no character a dotenv parser would interpret', () => {
    for (let i = 0; i < 20; i += 1) {
      const hash = hashPassword(`sample-${i}`);
      expect(hash, 'a $ in the hash is expanded away by dotenv-expand').not.toContain('$');
      expect(isEnvSafe(hash)).toBe(true);
    }
  });

  it('is only hex digits and full stops', () => {
    expect(hashPassword('x')).toMatch(/^scrypt\.[0-9a-f]{32}\.[0-9a-f]{128}$/);
  });

  it('still verifies a legacy $-separated hash', () => {
    // Anything stored before the format changed must keep working.
    const modern = hashPassword('legacy-password');
    const legacy = modern.replace(/\./g, '$');
    expect(verifyPassword('legacy-password', legacy)).toBe(true);
  });

  it('flags values that would be mangled', () => {
    expect(isEnvSafe('scrypt$abc$def')).toBe(false);
    expect(isEnvSafe('has space')).toBe(false);
    expect(isEnvSafe('scrypt.abc.def')).toBe(true);
  });
});
