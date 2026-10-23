import { describe, expect, it } from 'vitest';
import { TRACK_STEPS, trackView } from './tracking';

const placedAt = '2026-10-20T10:00:00.000Z';

describe('trackView', () => {
  it('a shipped order: earlier steps done, shipped current, delivered upcoming', () => {
    const view = trackView('shipped', placedAt, [
      { status: 'confirmed', at: '2026-10-20T11:00:00.000Z' },
      { status: 'packed', at: '2026-10-21T09:00:00.000Z' },
      { status: 'shipped', at: '2026-10-21T15:00:00.000Z' },
    ]);
    expect(view.steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming']);
    expect(view.steps[0].at).toBe(placedAt);
    expect(view.steps[2].at).toBe('2026-10-21T09:00:00.000Z');
    expect(view.steps[3].at).toBe('2026-10-21T15:00:00.000Z');
    expect(view.steps[4].at).toBeUndefined();
    expect(view.headline).toBe('Shipped — on its way with the courier');
    expect(view.next).toBe('Next: delivered.');
    expect(view.percent).toBe(75);
  });

  it('awaiting payment sits on the first step', () => {
    const view = trackView('pending_payment', placedAt);
    expect(view.awaitingPayment).toBe(true);
    expect(view.currentIndex).toBe(0);
    expect(view.headline).toBe('Waiting for payment');
    expect(view.percent).toBe(0);
  });

  it('delivered: every step done, nothing next', () => {
    const view = trackView('delivered', placedAt);
    expect(view.steps.every((s) => s.state === 'done')).toBe(true);
    expect(view.next).toBeNull();
    expect(view.percent).toBe(100);
  });

  it('a step the order skipped — straight from confirmed to shipped — still counts as done', () => {
    const view = trackView('shipped', placedAt, [{ status: 'shipped', at: '2026-10-21T15:00:00.000Z' }]);
    expect(view.steps[2].key).toBe('packed');
    expect(view.steps[2].state).toBe('done');
    expect(view.steps[2].at).toBeUndefined();
  });

  it('cancelled after packing: shows how far it got, nothing current', () => {
    const view = trackView('cancelled', placedAt, [
      { status: 'confirmed', at: '2026-10-20T11:00:00.000Z' },
      { status: 'packed', at: '2026-10-21T09:00:00.000Z' },
      { status: 'cancelled', at: '2026-10-21T12:00:00.000Z' },
    ]);
    expect(view.cancelled).toBe(true);
    expect(view.currentIndex).toBe(-1);
    expect(view.steps.map((s) => s.state)).toEqual(['done', 'done', 'done', 'upcoming', 'upcoming']);
    expect(view.next).toBeNull();
  });

  it('uses the latest time a status was entered', () => {
    const view = trackView('shipped', placedAt, [
      { status: 'shipped', at: '2026-10-21T09:00:00.000Z' },
      { status: 'shipped', at: '2026-10-22T09:00:00.000Z' },
    ]);
    expect(view.steps[3].at).toBe('2026-10-22T09:00:00.000Z');
  });

  it('a packed order is waiting to ship', () => {
    const view = trackView('packed', placedAt);
    expect(view.steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming']);
    expect(view.next).toBe('Next: shipped.');
  });

  it('prefers the stored stage dates, with payment dating "confirmed"', () => {
    const view = trackView('delivered', placedAt, [], {
      paidAt: '2026-10-20T10:05:00.000Z',
      packedAt: '2026-10-21T08:00:00.000Z',
      shippedAt: '2026-10-21T12:00:00.000Z',
      deliveredAt: '2026-10-23T16:00:00.000Z',
    });
    expect(view.steps.map((s) => s.at)).toEqual([
      placedAt,
      '2026-10-20T10:05:00.000Z',
      '2026-10-21T08:00:00.000Z',
      '2026-10-21T12:00:00.000Z',
      '2026-10-23T16:00:00.000Z',
    ]);
  });

  it('lists only statuses an order can reach, Packed included', () => {
    expect(TRACK_STEPS.map((s) => s.key)).toEqual(['placed', 'confirmed', 'packed', 'shipped', 'delivered']);
  });
});
