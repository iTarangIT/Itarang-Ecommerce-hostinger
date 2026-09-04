import { describe, expect, it } from 'vitest';
import { STATES, addressSchema } from '@/lib/checkout/validation';
import { profileSchema, savedAddressSchema } from './address-validation';

/**
 * What a saved address is allowed to contain.
 *
 * Pure validation, so no database. The ownership rules that matter just as much
 * live in `addresses.integration.test.ts`, because they are properties of a
 * WHERE clause and cannot be demonstrated without one.
 */

const VALID = {
  line1: '12 MG Road',
  line2: 'Near the depot',
  landmark: 'Opposite the bus stand',
  city: 'Lucknow',
  state: 'Uttar Pradesh',
  pincode: '226001',
  recipientName: 'A Person',
  recipientPhone: '9876543210',
};

describe('a saved address', () => {
  it('accepts a complete, valid Indian address', () => {
    const parsed = savedAddressSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it('accepts one with no second line and no landmark', () => {
    const parsed = savedAddressSchema.safeParse({ ...VALID, line2: '', landmark: '' });
    expect(parsed.success).toBe(true);
  });

  /* ------------------------------------------------------------- pincode */

  it.each([
    ['too short', '2260'],
    ['too long', '2260011'],
    ['not digits', 'ABC123'],
    ['empty', ''],
    ['digits with a space', '226 001'],
  ])('rejects a pincode that is %s', (_why, pincode) => {
    const parsed = savedAddressSchema.safeParse({ ...VALID, pincode });
    expect(parsed.success).toBe(false);
  });

  it('reuses the checkout pincode rule rather than restating it', () => {
    // If these two ever disagree, an address the book accepts would be one
    // checkout refuses — so the agreement is asserted, not assumed.
    const bad = { ...VALID, pincode: '12' };
    expect(savedAddressSchema.safeParse(bad).success).toBe(false);
    expect(addressSchema.safeParse({ ...bad, state: 'Uttar Pradesh' }).success).toBe(false);
  });

  /* --------------------------------------------------------------- state */

  it.each(STATES.map((entry) => entry.name))('accepts %s', (state) => {
    expect(savedAddressSchema.safeParse({ ...VALID, state }).success).toBe(true);
  });

  it.each([
    ['a misspelling', 'Uttar Pradsh'],
    ['a country', 'India'],
    ['a foreign region', 'California'],
    ['empty', ''],
    ['a single letter', 'U'],
    ['an abbreviation', 'UP'],
  ])('rejects %s as a state', (_why, state) => {
    const parsed = savedAddressSchema.safeParse({ ...VALID, state });
    expect(parsed.success).toBe(false);
  });

  it('normalises casing to the spelling stateCode() can resolve', () => {
    // The point of the strictness: a stored name that `stateCode()` does not
    // recognise becomes a missing GST place-of-supply on an invoice, far from
    // where anybody could have corrected it.
    const parsed = savedAddressSchema.safeParse({ ...VALID, state: '  uttar pradesh  ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.state).toBe('Uttar Pradesh');
  });

  it('is stricter than the shared checkout schema, which is left alone', () => {
    // `addressSchema` still takes any 2–120 character string. Narrowing the
    // live order path could refuse a genuine order and is not part of this
    // stage; the tightening applies to saved addresses only.
    const typo = { ...VALID, state: 'Uttar Pradsh' };
    expect(savedAddressSchema.safeParse(typo).success).toBe(false);
    expect(addressSchema.safeParse(typo).success).toBe(true);
  });

  /* ----------------------------------------------------------- recipient */

  it.each([
    ['a landline-style number', '1234567890'],
    ['one starting with 5', '5876543210'],
    ['nine digits', '987654321'],
    ['eleven digits', '98765432101'],
    ['with a country code', '+919876543210'],
  ])('rejects %s as a recipient phone', (_why, recipientPhone) => {
    expect(savedAddressSchema.safeParse({ ...VALID, recipientPhone }).success).toBe(false);
  });

  it('requires a recipient name', () => {
    expect(savedAddressSchema.safeParse({ ...VALID, recipientName: '' }).success).toBe(false);
    expect(savedAddressSchema.safeParse({ ...VALID, recipientName: 'A' }).success).toBe(false);
  });

  it('requires a street line long enough to deliver to', () => {
    expect(savedAddressSchema.safeParse({ ...VALID, line1: '12' }).success).toBe(false);
  });

  it('requires a city', () => {
    expect(savedAddressSchema.safeParse({ ...VALID, city: '' }).success).toBe(false);
  });
});

describe('the profile form', () => {
  it('accepts a name with no phone, because a code-created account has none', () => {
    expect(profileSchema.safeParse({ fullName: 'A Person', phone: '' }).success).toBe(true);
  });

  it('accepts a valid Indian mobile', () => {
    expect(profileSchema.safeParse({ fullName: 'A Person', phone: '9876543210' }).success).toBe(
      true,
    );
  });

  it('rejects a malformed phone rather than storing it', () => {
    // It carries a unique index and is intended to become a sign-in
    // identifier, so a junk value is not a harmless display string.
    expect(profileSchema.safeParse({ fullName: 'A Person', phone: '12345' }).success).toBe(false);
  });

  it('requires a name', () => {
    expect(profileSchema.safeParse({ fullName: '', phone: '' }).success).toBe(false);
  });

  it('does not accept an email, because that is a credential', () => {
    const parsed = profileSchema.safeParse({
      fullName: 'A Person',
      phone: '',
      email: 'new@example.com',
    });
    // Zod strips unknown keys; the point is that nothing here can change it.
    expect(parsed.success).toBe(true);
    if (parsed.success) expect('email' in parsed.data).toBe(false);
  });
});
