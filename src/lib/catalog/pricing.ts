import type { Availability, Paise, Price, Product, ProductVariant } from '@/lib/commerce/types';

/** Cheapest selling price across a product's variants. */
export function minSellingPrice(product: Product): Paise {
  return product.variants.reduce(
    (min, v) => (v.price.selling < min ? v.price.selling : min),
    product.variants[0]?.price.selling ?? 0,
  );
}

/** The variant a listing card should quote — cheapest available, else cheapest. */
export function displayVariant(product: Product): ProductVariant | undefined {
  const available = product.variants.filter((v) => v.availability !== 'out-of-stock');
  const pool = available.length > 0 ? available : product.variants;
  return pool.reduce<ProductVariant | undefined>(
    (best, v) => (!best || v.price.selling < best.price.selling ? v : best),
    undefined,
  );
}

export function displayPrice(product: Product): Price {
  const variant = displayVariant(product);
  return variant?.price ?? { mrp: 0, selling: 0 };
}

/** Rolled-up availability: in stock if any variant is. */
export function productAvailability(product: Product): Availability {
  if (product.variants.some((v) => v.availability === 'in-stock')) return 'in-stock';
  if (product.variants.some((v) => v.availability === 'low-stock')) return 'low-stock';
  if (product.variants.some((v) => v.availability === 'preorder')) return 'preorder';
  return 'out-of-stock';
}

export function discountPercent(price: Price): number {
  if (price.mrp <= 0 || price.selling >= price.mrp) return 0;
  return Math.round(((price.mrp - price.selling) / price.mrp) * 100);
}

export function savingsAmount(price: Price): Paise {
  return Math.max(0, price.mrp - price.selling);
}

const INR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Paise → "₹8,299". Whole rupees; this catalogue has no sub-rupee pricing. */
export function formatPrice(paise: Paise): string {
  return INR.format(Math.round(paise / 100));
}

/** Paise → "8,299" without the symbol, for inputs and compact contexts. */
export function formatAmount(paise: Paise): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    Math.round(paise / 100),
  );
}

/**
 * Indicative no-cost EMI instalment over `months`.
 * "No cost" means the instalment is simply the price divided by the tenure.
 */
export function emiPerMonth(paise: Paise, months = 6): Paise {
  return Math.round(paise / months);
}
