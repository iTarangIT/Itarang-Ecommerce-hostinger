# Product creation and publishing rules

How a product is identified, what must be filled in, and when it can go live.
Enforced in code; the file/line references point at where.

## Identifiers

| Thing | What it is | Unique? | Who sets it |
|---|---|---|---|
| **Product key / URL slug** | The product's own identifier, and its address (`/products/<slug>`). | Yes, across all products. | Generated from the title (plus model number) when the product is created. A clash gets `-2`, `-3`… (`src/lib/admin/product-actions.ts`, `createProductAction`). The slug can be changed later on the **SEO & URL** tab. |
| **SKU** | Identifies one sellable variant (a product with one size has one SKU). Used by stock, orders and the bulk price sheet. | Yes, across the whole catalogue, **ignoring capitals** (`TK-51100` and `tk-51100` are the same SKU). | Typed on the **Pricing** tab. |
| **Variant key** | Internal name of a variant inside one product (`default` for a single-size product). | Within the product only. | Pricing tab. |
| **Product name (title)** | What the shopper reads. | **No** — two products may have the same name. | Create form / Information tab. |

So the **primary identifier is the product key**; the SKU is the identifier
for stock and pricing, and the one the business works with day to day.

## SKU rules

- Required on every variant (the field is marked `*` and the form will not
  submit without it; the server refuses it too).
- Letters, digits and `- _ / .` only, no spaces, up to 64 characters, starting
  with a letter or digit (`src/lib/products/sku-rules.ts`).
- Unique ignoring capitals — database index from migration
  `0026_sku_case_insensitive.sql`.
- Two rows of the same product with the same SKU or variant key are refused
  with a message naming both rows; a SKU already used by another product is
  refused with that SKU named.

## Duplicate names

Allowed. Creating "Trontek 51V 105Ah Battery" twice gives two products at
`/products/trontek-51v-105ah-battery` and `/products/trontek-51v-105ah-battery-2`,
each with its own SKU. Give them different subtitles or model numbers so
shoppers can tell them apart.

## Creating a product

Required on the create form: **title**, **category**, **subcategory** (the
subcategory must belong to the category; categories are managed at
Admin → Products → Categories). The product starts as a **draft** and is not
visible on the site.

## Publishing

A draft can be published only when it has all of
(`src/lib/products/state-machine.ts`, `publishBlockers`):

1. a title and a slug,
2. a subcategory,
3. at least one variant,
4. a price on every variant (MRP and selling price),
5. at least one image,
6. a description.

The admin is told exactly which of these are missing.

## Frequently changed fields

MRP, selling price, cost price, stock and availability can be changed for many
products at once from Admin → Products → **Bulk pricing** (Excel, keyed on
SKU). Stock `0` takes a product off sale. Cost price is admin-only and never
shown on the site.
