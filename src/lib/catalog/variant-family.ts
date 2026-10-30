import type { Paise, Product } from '@/lib/commerce/types';
import { displayPrice, productAvailability } from './pricing';

/**
 * Product families: one page per family with a capacity dropdown (R-11, D-16).
 *
 * A family is not a product with several variants. Powercube 1.4 and 2.7 have
 * their own SKUs, prices, stock, images and specifications, and each keeps its
 * own page, URL and order history. What the family adds is a way across: each
 * member's page lists the others, and choosing one opens that member's page.
 *
 * Built from the published catalogue the page already holds, so a draft or
 * archived sibling can never appear in the dropdown — it is not in the
 * catalogue to be found. Client-safe: no server imports.
 */

export interface FamilyOption {
  slug: string;
  /** What the dropdown shows, e.g. "1.4 kWh". */
  label: string;
  /** The price a shopper would pay for this member's first variant. */
  selling: Paise;
  available: boolean;
  /** The member whose page this is. */
  current: boolean;
}

/**
 * Leading number of a label, for ordering "1.4 kWh" before "10 kWh".
 * A label with no number sorts after every label with one.
 */
function leadingNumber(label: string): number {
  const value = Number.parseFloat(label.replace(/^[^\d.]+/, ''));
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

/**
 * The dropdown for `product`, or null when there is nothing to choose between.
 *
 * Null for a product with no family, and also for a family of one: a dropdown
 * with a single entry offers no choice, and the moment a second member is
 * published (Powercube 2.7, B-01) it appears without a code change.
 */
export function familyOptions(product: Product, catalogue: readonly Product[]): FamilyOption[] | null {
  const group = product.variantGroup;
  if (!group) return null;

  const members = catalogue.filter((candidate) => candidate.variantGroup === group);
  // The page's own product is always an option, even if the catalogue it was
  // handed is a stale snapshot that does not include it.
  if (!members.some((member) => member.slug === product.slug)) members.push(product);
  if (members.length < 2) return null;

  return members
    .map((member) => ({
      slug: member.slug,
      label: member.variantLabel ?? member.title,
      selling: displayPrice(member).selling,
      available: productAvailability(member) !== 'out-of-stock',
      current: member.slug === product.slug,
    }))
    .sort(
      (a, b) =>
        leadingNumber(a.label) - leadingNumber(b.label) ||
        a.label.localeCompare(b.label, 'en-IN', { numeric: true }),
    );
}
