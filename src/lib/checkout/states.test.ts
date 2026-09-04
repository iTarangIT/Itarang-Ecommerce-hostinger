import { describe, expect, it } from 'vitest';
import { STATES, stateCode } from './validation';

/**
 * The Indian state and union territory list.
 *
 * This array is load-bearing in three places at once: it renders the checkout
 * state dropdown, it renders the saved-address dropdown, and `stateCode()`
 * reads it to derive the GST place-of-supply that `place-order.ts` writes onto
 * every order. A name missing from it is not a cosmetic gap — it is a customer
 * who cannot pick their own territory, and an invoice with no place of supply.
 *
 * Four were missing until the address book began validating against it, which
 * is what made the omission visible: while `state` was free text, an unknown
 * name just produced `undefined` and a blank field far downstream.
 */

/** The GST state codes in force, as of this list. */
const EXPECTED: Record<string, string> = {
  'Jammu and Kashmir': '01',
  'Himachal Pradesh': '02',
  Punjab: '03',
  Chandigarh: '04',
  Uttarakhand: '05',
  Haryana: '06',
  Delhi: '07',
  Rajasthan: '08',
  'Uttar Pradesh': '09',
  Bihar: '10',
  Sikkim: '11',
  'Arunachal Pradesh': '12',
  Nagaland: '13',
  Manipur: '14',
  Mizoram: '15',
  Tripura: '16',
  Meghalaya: '17',
  Assam: '18',
  'West Bengal': '19',
  Jharkhand: '20',
  Odisha: '21',
  Chhattisgarh: '22',
  'Madhya Pradesh': '23',
  Gujarat: '24',
  'Dadra and Nagar Haveli and Daman and Diu': '26',
  Maharashtra: '27',
  Karnataka: '29',
  Goa: '30',
  Lakshadweep: '31',
  Kerala: '32',
  'Tamil Nadu': '33',
  Puducherry: '34',
  'Andaman and Nicobar Islands': '35',
  Telangana: '36',
  'Andhra Pradesh': '37',
  Ladakh: '38',
};

describe('the state and union territory list', () => {
  it('covers every Indian state and union territory', () => {
    expect(STATES.map((entry) => entry.name).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('maps %s to GST code %s', (name, code) => {
    expect(stateCode(name)).toBe(code);
  });

  it('includes the four that were missing before the address book validated against it', () => {
    // Named individually so a future edit that drops one fails with a message
    // that says which, rather than an opaque array mismatch.
    for (const name of [
      'Andaman and Nicobar Islands',
      'Dadra and Nagar Haveli and Daman and Diu',
      'Ladakh',
      'Lakshadweep',
    ]) {
      expect(stateCode(name), `${name} is missing`).toBeDefined();
    }
  });

  it('omits codes that have been retired', () => {
    // 25 was Daman and Diu, merged into 26 in 2020. 28 was the undivided Andhra
    // Pradesh, split when Telangana was created. An invoice must not be issued
    // against a place of supply that no longer exists.
    const codes = STATES.map((entry) => entry.code);
    expect(codes).not.toContain('25');
    expect(codes).not.toContain('28');
  });

  it('assigns each code to exactly one name', () => {
    const codes = STATES.map((entry) => entry.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('lists each name once', () => {
    const names = STATES.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('stays in alphabetical order, which is the order both dropdowns render', () => {
    const names = STATES.map((entry) => entry.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('resolves a name regardless of casing or padding', () => {
    expect(stateCode('  ladakh  ')).toBe('38');
    expect(stateCode('LAKSHADWEEP')).toBe('31');
  });

  it('returns undefined for a name it does not know, rather than guessing', () => {
    // `place-order.ts` writes this straight to `place_of_supply`, so a wrong
    // guess would be worse than a null.
    expect(stateCode('Daman and Diu')).toBeUndefined();
    expect(stateCode('Not A State')).toBeUndefined();
    expect(stateCode('')).toBeUndefined();
  });
});
