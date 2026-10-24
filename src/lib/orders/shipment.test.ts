import { describe, expect, it } from 'vitest';
import { hasShipmentDetails, parseShipment } from './shipment';
import { eventLabel } from './tracking';

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe('parseShipment', () => {
  it('keeps the filled fields, trimmed, and drops blank ones', () => {
    const result = parseShipment(form({ courierName: ' Delhivery ', trackingNumber: 'AWB1', deliveryPerson: '' }));
    expect(result).toEqual({ ok: true, shipment: { courierName: 'Delhivery', trackingNumber: 'AWB1' } });
  });

  it('accepts an https tracking link and refuses anything that is not http(s)', () => {
    expect(parseShipment(form({ trackingUrl: 'https://track.example.com/1' })).ok).toBe(true);
    expect(parseShipment(form({ trackingUrl: 'javascript:alert(1)' }))).toMatchObject({ ok: false });
    expect(parseShipment(form({ trackingUrl: 'not a link' }))).toMatchObject({ ok: false });
  });

  it('checks the delivery phone is a phone number', () => {
    expect(parseShipment(form({ deliveryPhone: '+91 98765-43210' })).ok).toBe(true);
    expect(parseShipment(form({ deliveryPhone: 'call me' }))).toMatchObject({ ok: false });
  });

  it('knows whether anything was entered', () => {
    expect(hasShipmentDetails({})).toBe(false);
    expect(hasShipmentDetails({ courierName: 'X' })).toBe(true);
  });
});

describe('eventLabel', () => {
  it('reads history entries in words', () => {
    expect(eventLabel(null, 'pending_payment')).toBe('Order placed');
    expect(eventLabel('payment:pending', 'payment:paid')).toBe('Payment received');
    expect(eventLabel('confirmed', 'packed')).toBe('Packed');
    expect(eventLabel('shipped', 'shipped')).toBe('Update');
  });
});
