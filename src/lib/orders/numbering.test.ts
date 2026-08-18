import { describe, expect, it } from 'vitest';
import {
  ORDER_NUMBER_PATTERN,
  generateOrderNumber,
  isValidOrderNumber,
  normaliseOrderNumber,
} from './numbering';

describe('generateOrderNumber', () => {
  it('encodes the year and month', () => {
    expect(generateOrderNumber(new Date('2026-08-14T00:00:00Z'))).toMatch(/^ITG-2608-/);
    expect(generateOrderNumber(new Date('2026-01-02T00:00:00Z'))).toMatch(/^ITG-2601-/);
  });

  it('matches the documented pattern', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateOrderNumber()).toMatch(ORDER_NUMBER_PATTERN);
    }
  });

  it('omits glyphs that are ambiguous when read aloud', () => {
    const suffixes = Array.from({ length: 400 }, () => generateOrderNumber().split('-')[2]).join('');
    for (const ambiguous of ['I', 'L', 'O', 'U']) {
      expect(suffixes).not.toContain(ambiguous);
    }
  });

  it('is not sequential — successive numbers differ unpredictably', () => {
    const batch = new Set(Array.from({ length: 500 }, () => generateOrderNumber()));
    // 32^6 ≈ 1.07e9, so 500 draws colliding would be extraordinary.
    expect(batch.size).toBe(500);
  });
});

describe('validation and normalisation', () => {
  it('accepts a generated number', () => {
    expect(isValidOrderNumber(generateOrderNumber())).toBe(true);
  });

  it('accepts lowercase and padded input from a customer', () => {
    const number = generateOrderNumber();
    expect(isValidOrderNumber(`  ${number.toLowerCase()}  `)).toBe(true);
    expect(normaliseOrderNumber(`  ${number.toLowerCase()}  `)).toBe(number);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', 'ITG', 'ITG-2608', 'ITG-2608-ABC', 'XYZ-2608-ABC123', '2608-ABC123']) {
      expect(isValidOrderNumber(bad)).toBe(false);
    }
  });

  it('rejects a suffix containing an excluded glyph', () => {
    expect(isValidOrderNumber('ITG-2608-ABCDEI')).toBe(false);
  });
});
