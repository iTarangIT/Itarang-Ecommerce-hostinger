import { randomInt } from 'node:crypto';

/**
 * Order numbers.
 *
 * Format: `ITG-YYMM-XXXXXX`, e.g. `ITG-2608-7K4QM2`.
 *
 * Deliberately not sequential. A sequential number is a public counter that
 * tells anyone who orders twice how many orders the business took in between,
 * and lets a stranger enumerate other people's orders by guessing. The suffix
 * is drawn from a crypto RNG over a 28-character alphabet with the ambiguous
 * glyphs removed (no I, L, O, U), so it survives being read aloud over the
 * phone to support.
 *
 * Uniqueness is guaranteed by the unique index on `orders.order_number`, not by
 * hope: the repository retries on collision.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 6;

export function generateOrderNumber(now: Date = new Date()): string {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }

  return `ITG-${yy}${mm}-${suffix}`;
}

export const ORDER_NUMBER_PATTERN = /^ITG-\d{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/;

export function isValidOrderNumber(value: string): boolean {
  return ORDER_NUMBER_PATTERN.test(value.trim().toUpperCase());
}

export function normaliseOrderNumber(value: string): string {
  return value.trim().toUpperCase();
}
