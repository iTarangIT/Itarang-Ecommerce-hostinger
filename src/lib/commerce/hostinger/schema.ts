import { z } from 'zod';

/**
 * Hostinger Sales Channel API payloads.
 *
 * Modelled from the live `/products`, `/variants` and `/settings` responses.
 * Deliberately tolerant: unknown fields pass through and anything the UI does
 * not depend on is optional, so a Hostinger-side addition never breaks the
 * build. The fields we *do* rely on are strict, because silently accepting a
 * missing price is worse than failing the fetch.
 */

export const currencySchema = z.object({
  code: z.string(),
  symbol: z.string().optional(),
  symbol_native: z.string().optional(),
  name: z.string().optional(),
  name_plural: z.string().optional(),
  /** Minor-unit exponent. 2 for INR, so `amount` is paise. */
  decimal_digits: z.number().int().min(0).max(4),
  rounding: z.number().optional(),
  template: z.string().optional(),
  min_amount: z.number().optional(),
});

export const priceSchema = z.object({
  amount: z.number(),
  sale_amount: z.number().nullable().optional(),
  currency_code: z.string(),
  currency: currencySchema,
});

export const optionValueSchema = z.object({
  id: z.string().optional(),
  option_id: z.string(),
  variant_id: z.string().optional(),
  value: z.string(),
});

export const variantSchema = z.object({
  id: z.string(),
  title: z.string(),
  image_url: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  manage_inventory: z.boolean().optional(),
  is_available: z.boolean().optional(),
  /** Present only when requested via `fields=inventory_quantity`. */
  inventory_quantity: z.number().nullable().optional(),
  prices: z.array(priceSchema).default([]),
  options: z.array(optionValueSchema).default([]),
});

export const productOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
  values: z.array(optionValueSchema).default([]),
});

export const imageSchema = z.object({
  url: z.string(),
  order: z.number().optional(),
  type: z.string().optional(),
});

export const additionalInfoSchema = z.object({
  id: z.string().optional(),
  order: z.number().optional(),
  title: z.string(),
  /** HTML. */
  description: z.string(),
});

export const productSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    subtitle: z.string().nullable().optional(),
    ribbon_text: z.string().nullable().optional(),
    /** HTML. */
    description: z.string().nullable().optional(),
    thumbnail: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    url_handle: z.string().nullable().optional(),
    product_collections: z.array(z.unknown()).default([]),
    order: z.number().optional(),
    variants: z.array(variantSchema).default([]),
    options: z.array(productOptionSchema).default([]),
    images: z.array(imageSchema).default([]),
    additional_info: z.array(additionalInfoSchema).default([]),
    type: z.object({ value: z.string() }).nullable().optional(),
    purchasable: z.boolean().optional(),
    is_available: z.boolean().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const productsResponseSchema = z.object({
  products: z.array(productSchema),
  count: z.number().optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

export const variantsResponseSchema = z.object({
  variants: z
    .array(
      z.object({
        id: z.string(),
        inventory_quantity: z.number().nullable().optional(),
      }),
    )
    .default([]),
});

export const settingsResponseSchema = z
  .object({
    store_owner: z.object({ language: z.string().optional() }).nullable().optional(),
    refund_policy_url: z.string().optional(),
    stripe_checkout: z.object({ is_available: z.boolean() }).optional(),
    product_reviews: z.object({ is_enabled: z.boolean() }).optional(),
  })
  .passthrough();

export type HostingerProduct = z.infer<typeof productSchema>;
export type HostingerVariant = z.infer<typeof variantSchema>;
export type HostingerPrice = z.infer<typeof priceSchema>;
export type HostingerSettings = z.infer<typeof settingsResponseSchema>;
export type HostingerProductsResponse = z.infer<typeof productsResponseSchema>;
export type HostingerVariantsResponse = z.infer<typeof variantsResponseSchema>;
