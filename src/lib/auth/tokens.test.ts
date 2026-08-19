import { describe, expect, it } from 'vitest';
import { hashToken, mintToken } from './tokens';

describe('token minting', () => {
  it('produces a URL-safe value that needs no escaping', () => {
    for (let i = 0; i < 50; i += 1) {
      // base64url only — safe in a cookie and in a query string as-is.
      expect(mintToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('carries 256 bits of entropy', () => {
    // 32 bytes base64url-encoded, unpadded.
    expect(mintToken()).toHaveLength(43);
  });

  it('never repeats', () => {
    const seen = new Set(Array.from({ length: 500 }, () => mintToken()));
    expect(seen.size).toBe(500);
  });
});

describe('token hashing', () => {
  it('is stable for the same token', () => {
    const token = mintToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('is a 64-character hex digest', () => {
    expect(hashToken('anything')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not contain the token', () => {
    // The digest is what reaches the database; the token must not be
    // recoverable from a table dump.
    const token = mintToken();
    expect(hashToken(token)).not.toContain(token);
  });

  it('separates two tokens that differ by one character', () => {
    expect(hashToken('token-a')).not.toBe(hashToken('token-b'));
  });
});
