import { describe, expect, it } from 'vitest';
import { transitionBetween } from './transitions';

/**
 * The one rule that decides whether an alert exists at all.
 *
 * A row in `stock_transitions` is written only where this returns a direction,
 * which is what makes "do not alert again while it stays out of stock"
 * structural rather than a de-duplication check with a cooldown window. If this
 * function ever answered for a non-crossing, the guarantee would be gone and
 * nothing downstream would notice.
 */

describe('crossing zero', () => {
  it('reports the last unit being sold', () => {
    expect(transitionBetween(1, 0)).toBe('out-of-stock');
    expect(transitionBetween(9, 0)).toBe('out-of-stock');
  });

  it('reports a restock', () => {
    expect(transitionBetween(0, 1)).toBe('back-in-stock');
    expect(transitionBetween(0, 40)).toBe('back-in-stock');
  });
});

describe('changes that are not crossings', () => {
  it('says nothing when stock merely falls', () => {
    expect(transitionBetween(9, 4)).toBeNull();
    expect(transitionBetween(2, 1)).toBeNull();
  });

  it('says nothing when stock merely rises', () => {
    expect(transitionBetween(4, 9)).toBeNull();
  });

  it('says nothing when nothing moved', () => {
    expect(transitionBetween(5, 5)).toBeNull();
  });

  it('says nothing for a variant that stays at zero', () => {
    // The whole idempotency guarantee. Editing any other field on a sold-out
    // product re-saves the same zero, and must not produce a second alert.
    expect(transitionBetween(0, 0)).toBeNull();
  });
});

describe('untracked stock is not zero stock', () => {
  it('says nothing when tracking is switched on', () => {
    // `0012_product_catalogue.sql` is explicit that NULL means "not counted".
    // Treating it as zero would announce that every untracked variant had just
    // come back into stock the first time anybody typed a number.
    expect(transitionBetween(null, 0)).toBeNull();
    expect(transitionBetween(null, 12)).toBeNull();
  });

  it('says nothing when tracking is switched off', () => {
    expect(transitionBetween(12, null)).toBeNull();
    expect(transitionBetween(0, null)).toBeNull();
  });

  it('says nothing when it was never tracked', () => {
    // Today's catalogue: every seeded variant has stock NULL.
    expect(transitionBetween(null, null)).toBeNull();
  });
});

describe('a negative count cannot manufacture a restock', () => {
  it('treats anything at or below zero as out of stock', () => {
    // The column has a CHECK (stock >= 0) so this should be unreachable, but
    // the comparison is `<= 0` rather than `=== 0` precisely so that a stray
    // negative reads as "none available" rather than as a crossing.
    expect(transitionBetween(-1, 0)).toBeNull();
    expect(transitionBetween(0, -1)).toBeNull();
  });
});
