import type { Product } from '@/lib/commerce/types';
import { productPath } from '@/lib/routes';
import type { FinanceLead } from './crm-lead';
import type { FormValues } from './request-forms';

/**
 * "Buy on finance" (R-15): what the enquiry is about, and the CRM lead built
 * from it. Pure — no database, no environment — so the server action, the
 * admin's "send again" and the tests all build the same thing.
 */

export type FinancePage = FinanceLead['page'];

/**
 * One line of what is being financed, named by variant id (what the buy box
 * and the cart both hold) or by SKU.
 */
export interface FinanceItemInput {
  variantId?: string;
  sku?: string;
  quantity?: number;
}

export interface FinanceSubject {
  productSku: string | null;
  productTitle: string | null;
  productUrl: string | null;
  pricePaise: number | null;
}

const NOTHING: FinanceSubject = { productSku: null, productTitle: null, productUrl: null, pricePaise: null };
const MAX_LINES = 20;
const MAX_TITLE = 300;

/**
 * Resolve what the shopper is asking to finance against the published catalogue.
 *
 * Only identifiers come from the browser; the title, page and price are looked up
 * here, so a tampered form can name a product but cannot change what the team
 * is told it costs. An unknown variant is dropped. One line (the product page, or
 * a single-item checkout) is described exactly; several lines — a checkout
 * cart — become one title listing each with its quantity, the cart's total
 * price, and no single SKU or page, since there is not one.
 */
export function describeFinanceItems(
  items: readonly FinanceItemInput[],
  catalogue: readonly Product[],
  siteUrl: string,
): FinanceSubject {
  type Match = { product: Product; variant: Product['variants'][number] };
  const byId = new Map<string, Match>();
  const bySku = new Map<string, Match>();
  for (const product of catalogue) {
    for (const variant of product.variants) {
      byId.set(variant.id, { product, variant });
      bySku.set(variant.sku.toLowerCase(), { product, variant });
    }
  }

  const lines = items
    .slice(0, MAX_LINES)
    .map((item) => {
      const match =
        (typeof item?.variantId === 'string' ? byId.get(item.variantId) : undefined) ??
        (typeof item?.sku === 'string' ? bySku.get(item.sku.trim().toLowerCase()) : undefined);
      if (!match) return null;
      const quantity = Math.min(Math.max(Math.trunc(Number(item.quantity) || 1), 1), 99);
      const title =
        match.product.options.length && match.variant.title
          ? `${match.product.title} — ${match.variant.title}`
          : match.product.title;
      return { ...match, quantity, title };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  if (lines.length === 0) return NOTHING;

  const total = lines.reduce((sum, line) => sum + line.variant.price.selling * line.quantity, 0);
  const pricePaise = total > 0 ? total : null;

  if (lines.length === 1) {
    const [line] = lines;
    return {
      productSku: line!.variant.sku,
      productTitle: line!.quantity > 1 ? `${line!.title} × ${line!.quantity}` : line!.title,
      productUrl: `${siteUrl.replace(/\/$/, '')}${productPath(line!.product.slug)}`,
      pricePaise,
    };
  }

  const title = lines.map((line) => `${line.title} × ${line.quantity}`).join(', ');
  return {
    productSku: null,
    productTitle: title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title,
    productUrl: null,
    pricePaise,
  };
}

/**
 * The subject as it is kept in `support_requests.details` — strings only, as
 * that column's other values are, and only the keys that have a value.
 */
export function subjectDetails(subject: FinanceSubject, page: FinancePage): FormValues {
  const details: FormValues = { page };
  if (subject.productSku) details.productSku = subject.productSku;
  if (subject.productTitle) details.productTitle = subject.productTitle;
  if (subject.productUrl) details.productUrl = subject.productUrl;
  if (subject.pricePaise !== null) details.pricePaise = String(subject.pricePaise);
  return details;
}

/** The CRM lead for a stored finance enquiry, exactly as the contract states it. */
export function financeLeadFrom(request: {
  reference: string;
  name: string;
  phone: string;
  pincode: string | null;
  details: FormValues;
}): FinanceLead {
  const price = Number(request.details.pricePaise);
  return {
    storeRef: request.reference,
    name: request.name,
    mobile: request.phone,
    pincode: request.pincode ?? '',
    productSku: request.details.productSku ?? null,
    productTitle: request.details.productTitle ?? null,
    productUrl: request.details.productUrl ?? null,
    pricePaise: request.details.pricePaise && Number.isInteger(price) && price > 0 ? price : null,
    page: request.details.page === 'checkout' ? 'checkout' : 'product',
  };
}
