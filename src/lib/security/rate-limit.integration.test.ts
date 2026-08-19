import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import { LIMITS, consume, sweepRateLimits } from './rate-limit';

/**
 * Rate limiting against a live PostgreSQL.
 *
 * The counter is a single upsert, so correctness under concurrency is the
 * interesting property and cannot be tested without a real database.
 */

function targetsRemote(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  try {
    return !isLocalHost(inspectDatabaseUrl(raw).host);
  } catch {
    return false;
  }
}

const REMOTE = targetsRemote();
const CONFIGURED =
  Boolean(process.env.DATABASE_URL) && (!REMOTE || process.env.DB_ALLOW_REMOTE_TESTS === 'true');

if (!CONFIGURED) {
  console.warn(
    '\n  [skipped] Rate-limit integration tests write real rows. Set ' +
      'DB_ALLOW_REMOTE_TESTS=true to run them against a remote database.\n',
  );
}

const PREFIX = 'ratesuite:';

describe.skipIf(!CONFIGURED)('rate limiting', () => {
  beforeEach(async () => {
    await query(`DELETE FROM rate_limits WHERE bucket LIKE $1`, [`${PREFIX}%`]);
  });

  afterAll(async () => {
    await query(`DELETE FROM rate_limits WHERE bucket LIKE $1`, [`${PREFIX}%`]);
    await closePool();
  });

  const config = { limit: 5, windowSeconds: 300 };

  it('allows up to the limit and refuses after it', async () => {
    const bucket = `${PREFIX}basic:${Date.now()}`;

    for (let i = 1; i <= config.limit; i += 1) {
      const result = await consume(bucket, config);
      expect(result.allowed, `attempt ${i}`).toBe(true);
    }

    const overflow = await consume(bucket, config);
    expect(overflow.allowed).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it('reports how long until the window resets', async () => {
    const bucket = `${PREFIX}reset:${Date.now()}`;
    const result = await consume(bucket, config);

    expect(result.resetSeconds).toBeGreaterThan(0);
    expect(result.resetSeconds).toBeLessThanOrEqual(config.windowSeconds);
  });

  it('counts down the remaining allowance', async () => {
    const bucket = `${PREFIX}remaining:${Date.now()}`;
    expect((await consume(bucket, config)).remaining).toBe(config.limit - 1);
    expect((await consume(bucket, config)).remaining).toBe(config.limit - 2);
  });

  it('keeps buckets independent', async () => {
    const a = `${PREFIX}a:${Date.now()}`;
    const b = `${PREFIX}b:${Date.now()}`;

    for (let i = 0; i < config.limit; i += 1) await consume(a, config);

    expect((await consume(a, config)).allowed).toBe(false);
    // Exhausting one subject must not lock out everybody else.
    expect((await consume(b, config)).allowed).toBe(true);
  });

  it('does not miscount when attempts arrive simultaneously', async () => {
    // The whole point of doing this in one upsert: two concurrent requests
    // must not both read the same count and both be allowed through.
    const bucket = `${PREFIX}concurrent:${Date.now()}`;
    const attempts = await Promise.all(
      Array.from({ length: 20 }, () => consume(bucket, config)),
    );

    expect(attempts.filter((a) => a.allowed)).toHaveLength(config.limit);
  });

  it('separates windows so a limit is not permanent', async () => {
    const bucket = `${PREFIX}window:${Date.now()}`;
    for (let i = 0; i < config.limit; i += 1) await consume(bucket, config);
    expect((await consume(bucket, config)).allowed).toBe(false);

    // Age the window out rather than waiting for it.
    await query(
      `UPDATE rate_limits SET window_start = window_start - interval '1 day' WHERE bucket = $1`,
      [bucket],
    );

    expect((await consume(bucket, config)).allowed).toBe(true);
  });

  it('sweeps windows nobody will read again', async () => {
    const bucket = `${PREFIX}sweep:${Date.now()}`;
    await consume(bucket, config);
    await query(
      `UPDATE rate_limits SET window_start = now() - interval '3 days' WHERE bucket = $1`,
      [bucket],
    );

    await sweepRateLimits();

    const rows = await query(`SELECT bucket FROM rate_limits WHERE bucket = $1`, [bucket]);
    expect(rows).toHaveLength(0);
  });

  it('has limits that are tight where it matters and loose where it does not', () => {
    // A policy assertion: sign-in must be stricter than checkout, or the
    // limits are the wrong way round.
    expect(LIMITS.login.limit).toBeLessThan(LIMITS.checkout.limit);
    expect(LIMITS.login.limit).toBeLessThan(LIMITS.loginByIp.limit);
    expect(LIMITS.passwordReset.limit).toBeLessThanOrEqual(LIMITS.login.limit);
  });
});
