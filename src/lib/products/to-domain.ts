import type {
  Availability,
  Product,
  ProductFacetValues,
  ProductVariant,
} from '@/lib/commerce/types';
import { artSet } from '@/lib/commerce/mock/art';
import type { ProductRecord, ProductVariantRecord } from './types';

/**
 * The one place a stored product becomes a shopper-facing one.
 *
 * Everything an administrator sees and a customer must not — draft status, the
 * editor's email, the Hostinger reference, a null price — stops here. The rest
 * is a straight projection, because `commerce/types.ts` `Product` was already
 * the right shape: `specGroups`, `faqs`, `highlights` and `seller` all existed
 * before this catalogue did.
 *
 * The one rule worth restating: **nothing is defaulted.** A record that does
 * not state a warranty, a return window or care instructions produces a
 * `Product` that does not either, and the PDP renders no such section. That is
 * the same contract `hostinger/map.ts` keeps, and the reason a product cannot
 * silently advertise terms nobody agreed to.
 */

/**
 * What "we do not track a number" becomes.
 *
 * Borrowed from `hostinger/map.ts`, which uses the same constant for variants
 * the merchant does not manage inventory on. A quantity is required by
 * `ProductVariant` and drives the low-stock badge and the quantity ceiling; 99
 * is high enough never to trip either, which is the honest rendering of "not
 * tracked". Zero would print "Sold out", a claim nobody made.
 */
const UNTRACKED_STOCK = 99;

function availabilityFor(stock: number): Availability {
  if (stock <= 0) return 'out-of-stock';
  if (stock <= 5) return 'low-stock';
  return 'in-stock';
}

/**
 * What a shopper is told about availability.
 *
 * **A counted quantity decides.** When `stock` is tracked, availability is
 * derived from it and the `availability` column is not consulted: a number
 * somebody maintains is a better answer than a label somebody set once.
 *
 * The column still matters, and still means what the schema says it means — it
 * is the answer for a variant whose stock is *not* tracked (`stock IS NULL`),
 * where it is the only statement available and can hold a product off sale or
 * mark it for pre-order without inventing a quantity for it.
 *
 * Why the order is this way round: every imported variant carries an explicit
 * `in-stock` and a NULL count. Had the label kept winning, an administrator
 * setting stock to 2 would still have read "In stock" instead of "Only 2 left",
 * and setting it to 0 would have changed nothing a shopper could see — the
 * first person to discover the product was gone would be whoever ordered it.
 */
function availabilityOf(record: ProductVariantRecord, stock: number): Availability {
  if (record.stock !== null) return availabilityFor(record.stock);
  return record.availability ?? availabilityFor(stock);
}

function toVariant(record: ProductVariantRecord, productKey: string): ProductVariant {
  const stock = record.stock ?? UNTRACKED_STOCK;
  return {
    id: `${productKey}:${record.variantKey}`,
    sku: record.sku,
    title: record.title,
    optionValues: record.optionValues,
    // A published product always has both, because `publishBlockers` refuses
    // to let it out otherwise. The fallbacks exist so a draft can still be
    // rendered by an admin preview without throwing.
    price: { mrp: record.mrp ?? 0, selling: record.selling ?? 0 },
    availability: availabilityOf(record, stock),
    stock,
  };
}

/**
 * Specification rows that duplicate a structured column, removed.
 *
 * `net_quantity` is a column on `products`, edited on the Information tab, and
 * the import also wrote it as a row inside the "Product details" group. Two
 * places holding one fact is one place too many: editing the column moved the
 * admin value to "2 Count" while the product page kept rendering the row's
 * "1 Count", and neither screen gave any hint the other existed.
 *
 * The column wins because it is typed, editable in one obvious place, and the
 * thing `Product.netQuantity` already carries. Dropping the row here means a
 * stray copy — left in an old database, or typed back into the Specifications
 * tab — cannot reappear beside the canonical value or contradict it.
 *
 * Deliberately narrow: this removes exactly one label and leaves every other
 * specification, including the rest of the "Product details" group, untouched.
 */
const COLUMN_BACKED_SPEC_LABELS = new Set(['net quantity']);

/**
 * Filterable values, with the warranty taken from its column.
 *
 * `warranty_months` had the same problem `net_quantity` did: the column and
 * `facets.warrantyMonths` both held it, and `facets.ts` reads only the facet
 * copy. Two consequences, both silent.
 *
 * The admin's "Comparison values" form rebuilds `facets` from the five inputs
 * it has, and there is no warranty input among them — so saving that tab
 * dropped `facets.warrantyMonths` and the Warranty filter quietly stopped
 * listing the product, with no way to put it back. And the six products whose
 * documents state no warranty never had the facet at all, so the filter only
 * ever offered the two that did.
 *
 * Deriving it here means the column is the only place a warranty is stored, the
 * filter always agrees with the product page, and clearing the column clears
 * the facet instead of leaving a stale figure behind.
 */
function facetsOf(record: ProductRecord): ProductFacetValues {
  const { warrantyMonths: _dropped, ...rest } = record.facets;
  return {
    ...rest,
    ...(record.warrantyMonths !== null ? { warrantyMonths: record.warrantyMonths } : {}),
  };
}

function withoutDuplicatedColumns(groups: ProductRecord['specGroups']): ProductRecord['specGroups'] {
  return groups
    .map((group) => ({
      ...group,
      specs: group.specs.filter(
        (spec) => !COLUMN_BACKED_SPEC_LABELS.has(spec.label.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.specs.length > 0);
}

export function toDomainProduct(record: ProductRecord): Product {
  const images = record.media.length
    ? // Primary first, then gallery order. The gallery and every product card
      // read images[0], so this ordering is the whole meaning of `is_primary`.
      [...record.media]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position)
        .map((media) => media.url)
    : artSet(record.art, 1);

  return {
    id: record.productKey,
    slug: record.slug,
    title: record.title,
    subtitle: record.subtitle,
    ...(record.brand ? { brand: record.brand } : {}),
    ...(record.modelName ? { model: record.modelName } : {}),
    ...(record.genericName ? { genericName: record.genericName } : {}),
    ...(record.productType ? { productType: record.productType } : {}),
    ...(record.netQuantity ? { netQuantity: record.netQuantity } : {}),
    category: record.category,
    subcategory: record.subcategory,
    art: record.art,
    images,
    highlights: record.highlights,
    description: record.description,
    specGroups: withoutDuplicatedColumns(record.specGroups),
    boxContents: record.boxContents,
    ...(record.careInstructions?.length ? { careInstructions: record.careInstructions } : {}),
    ...(record.seller
      ? {
          seller: {
            name: record.seller.name,
            address: record.seller.address ?? '',
            ...(record.seller.packedBy ? { packedBy: record.seller.packedBy } : {}),
            ...(record.seller.customerCarePhone
              ? { customerCarePhone: record.seller.customerCarePhone }
              : {}),
            ...(record.seller.customerCareEmail
              ? { customerCareEmail: record.seller.customerCareEmail }
              : {}),
            ...(record.seller.gstin ? { gstin: record.seller.gstin } : {}),
            ...(record.seller.grievanceOfficerName
              ? {
                  grievanceOfficer: [
                    record.seller.grievanceOfficerName,
                    record.seller.grievanceOfficerPhone,
                  ]
                    .filter(Boolean)
                    .join(' — '),
                }
              : {}),
          },
        }
      : {}),
    ...(record.manufacturer
      ? {
          manufacturer: {
            name: record.manufacturer.name,
            ...(record.manufacturer.legalName ? { legalName: record.manufacturer.legalName } : {}),
            ...(record.manufacturer.address ? { address: record.manufacturer.address } : {}),
            ...(record.manufacturer.website ? { website: record.manufacturer.website } : {}),
            ...(record.manufacturer.email ? { email: record.manufacturer.email } : {}),
            ...(record.manufacturer.phone ? { phone: record.manufacturer.phone } : {}),
            ...(record.manufacturer.countryOfOrigin
              ? { countryOfOrigin: record.manufacturer.countryOfOrigin }
              : {}),
          },
        }
      : {}),
    ...(record.hsnCode ? { hsnCode: record.hsnCode } : {}),
    ...(record.taxRate !== null ? { taxRate: record.taxRate } : {}),
    ...(record.returnWindowDays !== null ? { returnWindowDays: record.returnWindowDays } : {}),
    faqs: record.faqs,
    ...(record.sections.length ? { sections: record.sections } : {}),
    ...(record.warrantyMonths !== null ? { warrantyMonths: record.warrantyMonths } : {}),
    ...(record.warrantyCycles !== null ? { warrantyCycles: record.warrantyCycles } : {}),
    ...(record.warrantyText ? { warrantyText: record.warrantyText } : {}),
    installationIncluded: record.installationIncluded,
    // Set only when true, so a product that does not carry the offer has no
    // `emiEnabled` key at all rather than an explicit false. Absent is the
    // shape every other unstated claim on this type takes.
    ...(record.emiEnabled ? { emiEnabled: true } : {}),
    badges: record.badges,
    // No product in this catalogue has buyer-facing options yet. When one does,
    // the options are derived from the variants' `optionValues` rather than
    // stored twice.
    options: [],
    variants: record.variants.map((variant) => toVariant(variant, record.productKey)),
    // No review system exists, so no product has a rating. `null`, never a
    // fabricated average — the same position `hostinger-provider.ts` takes.
    rating: null,
    facets: facetsOf(record),
    frequentlyBoughtWith: [],
    relatedProductIds: [],
    launchedAt: record.launchedAt ?? record.createdAt.slice(0, 10),
    popularityRank: record.popularityRank ?? 1_000_000,
  };
}
