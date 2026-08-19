import { describe, expect, it } from 'vitest';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from './password';

describe('password policy', () => {
  it('accepts a reasonable password', () => {
    expect(passwordProblem('correct horse battery')).toBeNull();
  });

  it('requires a minimum length', () => {
    expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/);
    expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('refuses an absurdly long password', () => {
    // Unbounded input into scrypt is a denial-of-service lever.
    expect(passwordProblem('a'.repeat(MAX_PASSWORD_LENGTH + 1))).toMatch(/no more than/);
  });

  it('refuses the passwords everybody picks', () => {
    for (const common of ['password123', 'Password123', 'QWERTYUIOP', '1234567890']) {
      expect(passwordProblem(common), common).toMatch(/commonly used/);
    }
  });

  it('reports length before commonness', () => {
    // 'changeme' is both too short and on the list. "Use at least 10
    // characters" is the more actionable of the two, so it wins.
    expect(passwordProblem('changeme')).toMatch(/at least/);
  });

  it('does not impose composition rules', () => {
    // Long and memorable beats short and gnarly; `Passw0rd!` should not pass
    // just because it has a symbol, and a plain phrase should not fail.
    expect(passwordProblem('all lowercase letters here')).toBeNull();
  });
});

describe('password hashing (re-exported from the admin module)', () => {
  it('round-trips', () => {
    const stored = hashPassword('a fine password');
    expect(verifyPassword('a fine password', stored)).toBe(true);
    expect(verifyPassword('a fine passwore', stored)).toBe(false);
  });

  it('never stores the password itself', () => {
    expect(hashPassword('literal-secret')).not.toContain('literal-secret');
  });

  it('salts every hash separately', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });
});
