/**
 * Product identity rules — see docs/product-rules.md for the business version.
 *
 * - The product's own identifier is its key/slug (`products.product_key`),
 *   derived from the title when it is created.
 * - The SKU identifies one sellable variant. It is required, unique across the
 *   whole catalogue ignoring letter case (migration 0026), and it is what the
 *   bulk price sheet is keyed on.
 * - Product names may repeat; two products with the same title get slugs
 *   `name` and `name-2`.
 */

/**
 * Letters, digits and - _ / . , up to 64 characters, starting with a letter or
 * digit. Every SKU in the Trontek catalogue fits (e.g. TK-LiFe-5145-01).
 */
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/;

export const SKU_RULE = 'Use letters, digits and - _ / . only (no spaces), up to 64 characters.';

export function isValidSku(sku: string): boolean {
  return SKU_PATTERN.test(sku);
}

/**
 * The first SKU (ignoring case) or variant key used on two rows of one
 * product's form, as a sentence naming both rows; null when all are distinct.
 * Caught before the database so the message can say which rows.
 */
export function repeatedVariantField(
  variants: ReadonlyArray<{ sku: string; variantKey: string }>,
): string | null {
  const repeat = (values: string[]) => {
    const seen = new Map<string, number>();
    for (const [index, value] of values.entries()) {
      const earlier = seen.get(value);
      if (earlier !== undefined) return { value, rows: `${earlier + 1} and ${index + 1}` };
      seen.set(value, index);
    }
    return null;
  };

  const sku = repeat(variants.map((variant) => variant.sku.toUpperCase()));
  if (sku) return `SKU ${sku.value} appears on rows ${sku.rows}. Each variant needs its own SKU.`;
  const key = repeat(variants.map((variant) => variant.variantKey));
  if (key) return `Variant key "${key.value}" appears on rows ${key.rows}. Each variant needs its own key.`;
  return null;
}
