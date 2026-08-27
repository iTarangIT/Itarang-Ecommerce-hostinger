import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, query } from '@/lib/db/pool';
import { inspectDatabaseUrl, isLocalHost } from '@/lib/db/guard';
import {
  availableMonths,
  fulfilmentCounts,
  monthlyRevenue,
  recentFulfilment,
  resolveRange,
  revenue,
} from './analytics';

/**
 * Analytics against the local `itarang_dev` database.
 *
 * The timezone cases are the reason this file exists. India is UTC+5:30, so
 * every instant between 18:30 and 24:00 UTC belongs to the *next* IST day —
 * which means a report bucketed in UTC silently moves 5½ hours of trade into
 * the wrong day, and on the first of a month into the wrong month.
 *
 * `MARCH_31_LATE` and `APRIL_1_EARLY` below are 45 minutes apart and both fall on
 * 31 March in UTC. Correct IST bucketing puts them in different months. A UTC
 * implementation puts them in the same one and passes every other test in this
 * file, so these two are the ones that matter.
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
    REMOTE
      ? '\n  [skipped] Analytics integration tests write real rows and DATABASE_URL is remote. ' +
          'Set DB_ALLOW_REMOTE_TESTS=true to run them anyway.\n'
      : '\n  [skipped] Analytics integration tests need DATABASE_URL pointing at a local ' +
          'itarang_dev database. See README → Database.\n',
    );
}

const PHONE = '9000000055';

// The fixtures sit in 2099 so they cannot collide with seeded demo orders or
// real trade in the local database — an earlier draft used 2026 and quietly
// summed the seed data into its assertions. India has never observed DST, so
// the UTC+5:30 offset these cases turn on is the same in any year.

/** 23:30 IST on 31 March 2099 — 18:00 UTC the same day. */
const MARCH_31_LATE = '2099-03-31T18:00:00Z';
/** 00:15 IST on 1 April 2099 — 18:45 UTC on 31 March. */
const APRIL_1_EARLY = '2099-03-31T18:45:00Z';

interface SeedOptions {
  createdAt: string;
  total: number;
  paymentMethod?: 'razorpay-test' | 'mock' | 'cod';
  paymentStatus?: 'paid' | 'pending';
  status?: string;
  /** When the payment was captured, if different from `createdAt`. */
  capturedAt?: string;
  /** Stage events to record, each at `createdAt` unless given a time. */
  stages?: Array<{ stage: string; at?: string }>;
  signatureVerified?: boolean;
}

let counter = 0;

async function seedOrder(options: SeedOptions): Promise<number> {
  counter += 1;
  const {
    createdAt,
    total,
    paymentMethod = 'razorpay-test',
    paymentStatus = 'paid',
    status = 'confirmed',
    capturedAt = createdAt,
    stages = [],
    signatureVerified = true,
  } = options;

  const rows = await query<{ id: number }>(
    `INSERT INTO orders (
       order_number, status, payment_status, customer_name, customer_phone,
       shipping_address, subtotal, total, payment_method, is_test, created_at
     ) VALUES ($1,$2,$3,'Analytics Buyer',$4,'{"line1":"1 Test St","city":"Pune","state":"Maharashtra","pincode":"411001"}',
       $5,$5,$6,true,$7)
     RETURNING id`,
    [
      `ITG-ANL-${String(counter).padStart(6, '0')}`,
      status,
      paymentStatus,
      PHONE,
      total,
      paymentMethod,
      createdAt,
    ],
  );
  const orderId = rows[0].id;

  if (paymentStatus === 'paid' && paymentMethod !== 'cod') {
    await query(
      `INSERT INTO payments (order_id, provider, gateway_payment_id, status, amount,
                             signature_verified, created_at)
       VALUES ($1,$2,$3,'paid',$4,$5,$6)`,
      [orderId, paymentMethod, `pay_anl_${counter}`, total, signatureVerified, capturedAt],
    );
  }

  for (const entry of stages) {
    await query(
      `INSERT INTO order_events (order_id, from_status, to_status, actor, created_at)
       VALUES ($1, NULL, $2, 'test', $3)`,
      [orderId, entry.stage, entry.at ?? createdAt],
    );
  }

  return orderId;
}

describe.skipIf(!CONFIGURED)('admin analytics', () => {
  beforeEach(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    counter = 0;
  });

  afterAll(async () => {
    await query(`DELETE FROM orders WHERE customer_phone = $1`, [PHONE]);
    await closePool();
  });

  describe('Asia/Kolkata boundaries', () => {
    it('keeps 23:30 IST on the 31st in that month, not the next', async () => {
      await seedOrder({ createdAt: MARCH_31_LATE, capturedAt: MARCH_31_LATE, total: 100_000 });
      await seedOrder({ createdAt: APRIL_1_EARLY, capturedAt: APRIL_1_EARLY, total: 500_000 });

      const march = await resolveRange('month', '2099-03');
      const april = await resolveRange('month', '2099-04');

      // Both rows are 31 March in UTC. Only IST bucketing separates them.
      expect((await revenue(march.from, march.to)).gross).toBe(100_000);
      expect((await revenue(april.from, april.to)).gross).toBe(500_000);
    });

    it('starts an IST month at 18:30 UTC on the last day of the previous one', async () => {
      const april = await resolveRange('month', '2099-04');

      // 00:00 IST on 1 April is 18:30 UTC on 31 March.
      expect(april.from.toISOString()).toBe('2099-03-31T18:30:00.000Z');
      expect(april.to.toISOString()).toBe('2099-04-30T18:30:00.000Z');
    });

    it('treats the window as half-open so an instant lands in exactly one bucket', async () => {
      const march = await resolveRange('month', '2099-03');
      const april = await resolveRange('month', '2099-04');

      expect(march.to.getTime()).toBe(april.from.getTime());

      // An order at exactly that instant belongs to April, not March.
      await seedOrder({
        createdAt: april.from.toISOString(),
        capturedAt: april.from.toISOString(),
        total: 700_000,
      });

      expect((await revenue(march.from, march.to)).gross).toBe(0);
      expect((await revenue(april.from, april.to)).gross).toBe(700_000);
    });

    it('buckets a month series by IST, not UTC', async () => {
      await seedOrder({ createdAt: MARCH_31_LATE, capturedAt: MARCH_31_LATE, total: 100_000 });
      await seedOrder({ createdAt: APRIL_1_EARLY, capturedAt: APRIL_1_EARLY, total: 500_000 });

      // A wide window so the fixed fixture dates are always inside it.
      const series = await monthlyRevenue(600);
      const march = series.find((point) => point.month === '2099-03');
      const april = series.find((point) => point.month === '2099-04');

      expect(march?.gross).toBe(100_000);
      expect(april?.gross).toBe(500_000);
    });

    it('lists months in IST', async () => {
      await seedOrder({ createdAt: APRIL_1_EARLY, capturedAt: APRIL_1_EARLY, total: 100_000 });

      expect(await availableMonths()).toContain('2099-04');
    });
  });

  describe('revenue', () => {
    it('counts only captured, signature-verified payments', async () => {
      const range = await resolveRange('month', '2099-05');
      const at = '2099-05-10T06:00:00Z';

      await seedOrder({ createdAt: at, capturedAt: at, total: 100_000 });
      await seedOrder({ createdAt: at, capturedAt: at, total: 900_000, paymentStatus: 'pending' });
      await seedOrder({
        createdAt: at,
        capturedAt: at,
        total: 400_000,
        signatureVerified: false,
      });

      const result = await revenue(range.from, range.to);
      expect(result.gross).toBe(100_000);
      expect(result.orders).toBe(1);
    });

    it('excludes cash on delivery entirely', async () => {
      const range = await resolveRange('month', '2099-06');
      const at = '2099-06-10T06:00:00Z';

      await seedOrder({ createdAt: at, capturedAt: at, total: 100_000 });
      // A COD order marked paid is still out of scope for revenue.
      await seedOrder({
        createdAt: at,
        total: 800_000,
        paymentMethod: 'cod',
        paymentStatus: 'paid',
      });

      const result = await revenue(range.from, range.to);
      expect(result.gross).toBe(100_000);
      expect(result.byProvider.some((row) => row.provider === 'cod')).toBe(false);
    });

    it('buckets by capture time, not order creation', async () => {
      // Placed in July, paid in August — the money is August's.
      await seedOrder({
        createdAt: '2099-07-30T06:00:00Z',
        capturedAt: '2099-08-02T06:00:00Z',
        total: 250_000,
      });

      const july = await resolveRange('month', '2099-07');
      const august = await resolveRange('month', '2099-08');

      expect((await revenue(july.from, july.to)).gross).toBe(0);
      expect((await revenue(august.from, august.to)).gross).toBe(250_000);
    });

    it('reports average order value in paise', async () => {
      const range = await resolveRange('month', '2099-09');
      const at = '2099-09-10T06:00:00Z';
      await seedOrder({ createdAt: at, capturedAt: at, total: 100_000 });
      await seedOrder({ createdAt: at, capturedAt: at, total: 300_000 });

      const result = await revenue(range.from, range.to);
      expect(result.gross).toBe(400_000);
      expect(result.orders).toBe(2);
      expect(result.averageOrderValue).toBe(200_000);
    });

    it('reports zero rather than dividing by zero on an empty window', async () => {
      const range = await resolveRange('month', '2099-10');
      const result = await revenue(range.from, range.to);

      expect(result.gross).toBe(0);
      expect(result.orders).toBe(0);
      expect(result.averageOrderValue).toBe(0);
    });
  });

  describe('fulfilment', () => {
    it('counts an order at every stage it passed through', async () => {
      const at = '2099-11-10T06:00:00Z';
      await seedOrder({
        createdAt: at,
        capturedAt: at,
        total: 100_000,
        status: 'delivered',
        stages: [
          { stage: 'confirmed' },
          { stage: 'packed' },
          { stage: 'shipped' },
          { stage: 'delivered' },
        ],
      });

      const range = await resolveRange('month', '2099-11');
      const counts = await fulfilmentCounts(range.from, range.to);

      // A current-status count would show 1 delivered and 0 everywhere else.
      expect(counts.reached).toEqual({ confirmed: 1, packed: 1, shipped: 1, delivered: 1 });
      expect(counts.pipeline.delivered).toBe(1);
    });

    it('excludes cash on delivery from stage counts too', async () => {
      const at = '2099-12-10T06:00:00Z';
      await seedOrder({
        createdAt: at,
        total: 100_000,
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        stages: [{ stage: 'confirmed' }, { stage: 'packed' }],
      });

      const range = await resolveRange('month', '2099-12');
      const counts = await fulfilmentCounts(range.from, range.to);

      expect(counts.reached.confirmed).toBe(0);
      expect(counts.reached.packed).toBe(0);
      expect(counts.pipeline.confirmed).toBe(0);
    });

    it('ignores payment transitions stored in the same column', async () => {
      const at = '2100-01-10T06:00:00Z';
      await seedOrder({
        createdAt: at,
        capturedAt: at,
        total: 100_000,
        stages: [{ stage: 'confirmed' }, { stage: 'payment:paid' }, { stage: 'pending_payment' }],
      });

      const range = await resolveRange('month', '2100-01');
      const counts = await fulfilmentCounts(range.from, range.to);

      expect(counts.reached.confirmed).toBe(1);
      expect(counts.reached.packed).toBe(0);
    });

    it('places a stage in the window it happened in, not the order date', async () => {
      // Ordered in February, shipped in March.
      await seedOrder({
        createdAt: '2100-02-20T06:00:00Z',
        capturedAt: '2100-02-20T06:00:00Z',
        total: 100_000,
        status: 'shipped',
        stages: [
          { stage: 'confirmed', at: '2100-02-20T06:00:00Z' },
          { stage: 'shipped', at: '2100-03-05T06:00:00Z' },
        ],
      });

      const february = await resolveRange('month', '2100-02');
      const march = await resolveRange('month', '2100-03');

      expect((await fulfilmentCounts(february.from, february.to)).reached.shipped).toBe(0);
      expect((await fulfilmentCounts(march.from, march.to)).reached.shipped).toBe(1);
    });

    it('lists recent stage changes newest first', async () => {
      const at = '2100-04-10T06:00:00Z';
      await seedOrder({
        createdAt: at,
        capturedAt: at,
        total: 100_000,
        status: 'shipped',
        stages: [
          { stage: 'confirmed', at: '2100-04-10T06:00:00Z' },
          { stage: 'packed', at: '2100-04-11T06:00:00Z' },
          { stage: 'shipped', at: '2100-04-12T06:00:00Z' },
        ],
      });

      const range = await resolveRange('month', '2100-04');
      const rows = await recentFulfilment(range.from, range.to);

      expect(rows.map((row) => row.stage)).toEqual(['shipped', 'packed', 'confirmed']);
      expect(rows[0].total).toBe(100_000);
    });
  });

  describe('range resolution', () => {
    it('falls back to the current month when the month is malformed', async () => {
      const bad = await resolveRange('month', 'not-a-month');
      const current = await resolveRange('this_month');

      expect(bad.key).toBe('this_month');
      expect(bad.from.getTime()).toBe(current.from.getTime());
    });

    it('spans three calendar months for last_3_months', async () => {
      const range = await resolveRange('last_3_months');
      const months =
        (range.to.getUTCFullYear() - range.from.getUTCFullYear()) * 12 +
        (range.to.getUTCMonth() - range.from.getUTCMonth());

      expect(months).toBe(3);
    });

    it('spans six calendar months for last_6_months', async () => {
      const range = await resolveRange('last_6_months');
      const months =
        (range.to.getUTCFullYear() - range.from.getUTCFullYear()) * 12 +
        (range.to.getUTCMonth() - range.from.getUTCMonth());

      expect(months).toBe(6);
    });

    it('spans exactly one day for today', async () => {
      const range = await resolveRange('today');
      expect(range.to.getTime() - range.from.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    /* ------------------------------------------------------- custom range */

    it('spans exactly one day when start and end are the same date', async () => {
      const range = await resolveRange('custom', undefined, {
        from: '2099-04-10',
        to: '2099-04-10',
      });

      expect(range.key).toBe('custom');
      expect(range.error).toBeNull();
      expect(range.to.getTime() - range.from.getTime()).toBe(24 * 60 * 60 * 1000);
    });

    it('includes the end date rather than stopping at its start', async () => {
      const range = await resolveRange('custom', undefined, {
        from: '2099-04-01',
        to: '2099-04-15',
      });

      // Fifteen days, not fourteen: the end date the admin picked is a day they
      // expect counted, so the exclusive bound is the start of the 16th.
      const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * 60 * 1000);
      expect(days).toBe(15);
      expect(range.to.toISOString()).toBe('2099-04-15T18:30:00.000Z');
    });

    it('starts a custom range at midnight IST, not midnight UTC', async () => {
      const range = await resolveRange('custom', undefined, {
        from: '2099-04-01',
        to: '2099-04-01',
      });

      // 00:00 IST on 1 April is 18:30 UTC on 31 March.
      expect(range.from.toISOString()).toBe('2099-03-31T18:30:00.000Z');
    });

    it('agrees with the month preset over the same calendar month', async () => {
      const asMonth = await resolveRange('month', '2099-04');
      const asCustom = await resolveRange('custom', undefined, {
        from: '2099-04-01',
        to: '2099-04-30',
      });

      // The two routes to one window must not disagree by so much as a second.
      expect(asCustom.from.getTime()).toBe(asMonth.from.getTime());
      expect(asCustom.to.getTime()).toBe(asMonth.to.getTime());
      expect((await revenue(asCustom.from, asCustom.to)).gross).toBe(
        (await revenue(asMonth.from, asMonth.to)).gross,
      );
    });

    it('keeps the window half-open so an instant lands in exactly one bucket', async () => {
      const first = await resolveRange('custom', undefined, {
        from: '2099-04-01',
        to: '2099-04-15',
      });
      const second = await resolveRange('custom', undefined, {
        from: '2099-04-16',
        to: '2099-04-30',
      });

      expect(first.to.getTime()).toBe(second.from.getTime());
    });

    it('refuses a start after the end and keeps the range that was on screen', async () => {
      const range = await resolveRange('custom', undefined, {
        from: '2099-04-15',
        to: '2099-04-01',
        prev: 'last_month',
      });
      const previous = await resolveRange('last_month');

      expect(range.key).toBe('last_month');
      expect(range.error).toMatch(/must not be after/i);
      // Real numbers, not an empty dashboard that reads like a collapse.
      expect(range.from.getTime()).toBe(previous.from.getTime());
      expect(range.to.getTime()).toBe(previous.to.getTime());
    });

    it('refuses a date that does not exist', async () => {
      // `to_date` would silently roll this to 2 March and report a window
      // nobody asked for.
      const range = await resolveRange('custom', undefined, {
        from: '2099-02-30',
        to: '2099-03-05',
        prev: 'today',
      });

      expect(range.key).toBe('today');
      expect(range.error).toMatch(/not a real date/i);
    });

    it('refuses a half-filled range', async () => {
      const range = await resolveRange('custom', undefined, { from: '2099-04-01', prev: 'today' });

      expect(range.key).toBe('today');
      expect(range.error).toMatch(/both a start and an end/i);
    });

    it('falls back to this month when there is nothing to go back to', async () => {
      const range = await resolveRange('custom', undefined, { from: 'rubbish', to: 'rubbish' });
      const current = await resolveRange('this_month');

      expect(range.key).toBe('this_month');
      expect(range.error).not.toBeNull();
      expect(range.from.getTime()).toBe(current.from.getTime());
    });

    it('does not let a rejected range echo its dates back into the form', async () => {
      const range = await resolveRange('custom', undefined, {
        from: '2099-04-15',
        to: '2099-04-01',
        prev: 'today',
      });

      // The resolved range is `today`, so reporting custom dates alongside it
      // would label the screen with a window it is not showing.
      expect(range.customFrom).toBeNull();
      expect(range.customTo).toBeNull();
      // But what was typed still comes back, so the admin corrects the field
      // that was wrong instead of retyping both.
      expect(range.requestedFrom).toBe('2099-04-15');
      expect(range.requestedTo).toBe('2099-04-01');
    });

    it('leaves every preset exactly as it was', async () => {
      // The regression guard for this feature: a custom range is an addition,
      // and none of the six windows that already existed may move.
      const presets = ['today', 'this_month', 'last_month', 'last_3_months', 'last_6_months'] as const;

      for (const key of presets) {
        const range = await resolveRange(key);
        expect(range.key).toBe(key);
        expect(range.error).toBeNull();
        expect(range.customFrom).toBeNull();
        expect(range.customTo).toBeNull();
        // Midnight IST is 18:30 UTC the previous day, for every one of them.
        expect(range.from.toISOString()).toMatch(/T18:30:00\.000Z$/);
      }

      const month = await resolveRange('month', '2099-04');
      expect(month.key).toBe('month');
      expect(month.from.toISOString()).toBe('2099-03-31T18:30:00.000Z');
      expect(month.to.toISOString()).toBe('2099-04-30T18:30:00.000Z');
    });
  });
});
