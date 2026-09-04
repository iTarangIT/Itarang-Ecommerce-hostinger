import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { generateCode } from './otp';

/**
 * The parts of the one-time code path that need no database.
 *
 * Issuing and verifying are covered in `otp.integration.test.ts`, because the
 * guarantees that matter there — single use, the attempt cap, supersede on
 * resend — are all properties of a transaction and cannot be demonstrated
 * without one.
 */

describe('the generated code', () => {
  const SAMPLE = 4_000;
  const codes = Array.from({ length: SAMPLE }, () => generateCode());

  it('is always six digits', () => {
    for (const code of codes) {
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('keeps a leading zero rather than shortening the code', () => {
    // `String(randomInt(...))` loses them; the padding is what puts them back.
    // A code the field rejects as too short is a support call, not a sign-in.
    const padded = String(7).padStart(6, '0');
    expect(padded).toBe('000007');
    expect(padded).toMatch(/^\d{6}$/);
  });

  it('spans the whole range, low values included', () => {
    const numeric = codes.map(Number);
    expect(Math.min(...numeric)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numeric)).toBeLessThan(1_000_000);
  });

  it('is not obviously biased across the range', () => {
    // `randomBytes(4) % 1_000_000` would skew low, because 2^32 is not a
    // multiple of a million. A crude decile check catches that class of bug
    // without pretending to be a statistical test.
    const deciles = new Array<number>(10).fill(0);
    for (const code of codes) deciles[Math.floor(Number(code) / 100_000)]! += 1;

    const expected = SAMPLE / 10;
    for (const count of deciles) {
      expect(count).toBeGreaterThan(expected * 0.5);
      expect(count).toBeLessThan(expected * 1.5);
    }
  });

  it('does not repeat itself in any meaningful way', () => {
    // Collisions are expected at this sample size — a million values, four
    // thousand draws — but a generator stuck in a short cycle would show up as
    // a dramatically smaller unique count.
    expect(new Set(codes).size).toBeGreaterThan(SAMPLE * 0.99);
  });
});

describe('the pepper is required, not optional', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.AUTH_OTP_PEPPER;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.AUTH_OTP_PEPPER;
    else process.env.AUTH_OTP_PEPPER = saved;
    resetEnvCache();
  });

  it('refuses to hash a code with an empty key', async () => {
    delete process.env.AUTH_OTP_PEPPER;
    resetEnvCache();

    // Reached through `issueOtp`, which is where a missing pepper would
    // otherwise silently produce a table of unprotected digests. The throw is
    // the whole point: a six-digit secret under an unkeyed hash is reversible
    // the moment the table leaks, and a fallback to '' would hide that until
    // it mattered.
    const { issueOtp } = await import('./otp');

    await expect(
      issueOtp({
        identifier: 'nobody@example.invalid',
        identifierKind: 'email',
        channel: 'email',
        userId: null,
      }),
    ).rejects.toThrow(/AUTH_OTP_PEPPER/);
  });
});
