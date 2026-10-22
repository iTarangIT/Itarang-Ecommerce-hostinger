import { describe, expect, it } from 'vitest';
import {
  csvCell,
  datePresets,
  istDateTime,
  ordersCsv,
  parseTrackingQuery,
  toListFilters,
  trackingSearch,
} from './admin-tracking';
import type { Order } from './types';

describe('parseTrackingQuery', () => {
  it('defaults: newest placed first, 25 a page, nothing filtered', () => {
    const { query, dateError } = parseTrackingQuery({});
    expect(query).toMatchObject({ sort: 'placed', dir: 'desc', size: 25, offset: 0 });
    expect(query.status).toBeUndefined();
    expect(dateError).toBeNull();
  });

  it('drops values the enums do not allow', () => {
    const { query } = parseTrackingQuery({
      status: 'lost',
      payment: 'paid',
      method: 'cash',
      sort: 'id; DROP TABLE orders',
      size: '5000',
      offset: '-10',
    });
    expect(query.status).toBeUndefined();
    expect(query.payment).toBe('paid');
    expect(query.method).toBeUndefined();
    expect(query.sort).toBe('placed');
    expect(query.size).toBe(25);
    expect(query.offset).toBe(0);
  });

  it('keeps a valid range and maps it to list filters', () => {
    const { query } = parseTrackingQuery({ from: '2026-10-01', to: '2026-10-21', test: 'hide' });
    const filters = toListFilters(query);
    expect(filters.placedFrom).toBe('2026-10-01');
    expect(filters.placedTo).toBe('2026-10-21');
    expect(filters.isTest).toBe(false);
  });

  it('rejects an impossible or reversed range rather than guessing', () => {
    expect(parseTrackingQuery({ from: '2026-02-30' }).dateError).toMatch(/start date/);
    const reversed = parseTrackingQuery({ from: '2026-10-21', to: '2026-10-01' });
    expect(reversed.dateError).toMatch(/after the end/);
    expect(reversed.query.from).toBeUndefined();
    expect(reversed.query.to).toBeUndefined();
  });
});

describe('trackingSearch', () => {
  const { query } = parseTrackingQuery({ status: 'shipped', offset: '50' });

  it('leaves defaults out of the URL', () => {
    expect(trackingSearch(parseTrackingQuery({}).query)).toBe('');
  });

  it('a filter change returns to the first page; paging keeps the filters', () => {
    expect(trackingSearch(query, { sort: 'total' })).toBe('?status=shipped&sort=total');
    expect(trackingSearch(query, { offset: 75 })).toBe('?status=shipped&offset=75');
  });
});

describe('dates', () => {
  it('presets are IST calendar days', () => {
    // 20:00 UTC on the 21st is already the 22nd in India.
    const presets = datePresets(new Date('2026-10-21T20:00:00Z'));
    expect(presets.find((p) => p.label === 'Today')).toMatchObject({ from: '2026-10-22', to: '2026-10-22' });
    expect(presets.find((p) => p.label === 'Last 7 days')).toMatchObject({ from: '2026-10-16' });
    expect(presets.find((p) => p.label === 'This month')).toMatchObject({ from: '2026-10-01' });
  });

  it('istDateTime renders in India time', () => {
    expect(istDateTime('2026-10-21T14:04:00.000Z')).toBe('2026-10-21 19:34');
  });
});

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('Pune, MH')).toBe('"Pune, MH"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(undefined)).toBe('');
  });

  it('defuses formulas but leaves signed numbers alone', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('+919876543210')).toBe('+919876543210');
  });

  it('one header row and one row per order, amounts in rupees', () => {
    const order = {
      id: 1,
      orderNumber: 'ITG-2610-ABC',
      status: 'shipped',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      isTest: false,
      contact: { name: 'Asha', phone: '9876543210' },
      shippingAddress: { line1: '1 MG Road', city: 'Pune', state: 'MH', pincode: '411001' },
      amounts: {
        subtotal: 4924800,
        productSavings: 0,
        couponDiscount: 0,
        paymentDiscount: 0,
        shipping: 0,
        codFee: 0,
        total: 4924800,
        gstAmount: 0,
        gstRate: 18,
      },
      items: [{ title: 'Battery', sku: 'TK-1', quantity: 2 }],
      createdAt: '2026-10-21T14:04:00.000Z',
      updatedAt: '2026-10-21T14:04:00.000Z',
    } as unknown as Order;

    const lines = ordersCsv([order]).replace(/^﻿/, '').trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Order number,Placed \(IST\)/);
    expect(lines[1]).toContain('ITG-2610-ABC,2026-10-21 19:34');
    expect(lines[1]).toContain('Battery x2');
    expect(lines[1]).toContain('Guest');
    expect(lines[1]).toContain('49248.00');
  });
});
