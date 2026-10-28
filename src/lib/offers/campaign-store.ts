import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, queryOne } from '@/lib/db/pool';
import { isDatabaseUnavailable } from '@/lib/db/errors';
import { unstable_cache } from 'next/cache';
import { COUPONS, type CouponRule } from './coupons';
import { isLiveOnSite, phoneKey, type Campaign, type EligibilityContext } from './campaigns';

/**
 * The `campaigns` table (migration 0025): reads for checkout and the offers
 * page, writes for /admin/campaigns, and the redemption counts the limits
 * are checked against.
 *
 * If the table is missing (migration not yet applied) the two built-in WELCOME
 * codes are served instead, with their original once-per-customer rule.
 */

interface CampaignRow {
  id: number;
  code: string;
  name: string;
  label: string;
  description: string;
  kind: 'flat' | 'percent' | 'free-shipping';
  value: number;
  max_discount: number | null;
  min_cart: number | null;
  categories: string[];
  subcategories: string[];
  product_ids: string[];
  starts_at: Date | null;
  ends_at: Date | null;
  is_active: boolean;
  show_on_site: boolean;
  max_redemptions_total: number | null;
  max_per_customer: number | null;
  first_order_only: boolean;
  cities: string[];
  states: string[];
  customer_phones: string[];
  customer_types: string[];
}

const COLUMNS = `id, code, name, label, description, kind, value, max_discount, min_cart,
  categories, subcategories, product_ids, starts_at, ends_at, is_active, show_on_site,
  max_redemptions_total, max_per_customer, first_order_only, cities, states,
  customer_phones, customer_types`;

export function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    label: row.label,
    description: row.description,
    kind: row.kind,
    value: row.value,
    // `validateCoupon` reads "absent" as "no restriction", so empty → undefined.
    maxDiscount: row.max_discount ?? undefined,
    minCart: row.min_cart ?? undefined,
    categories: row.categories.length ? row.categories : undefined,
    subcategories: row.subcategories.length ? row.subcategories : undefined,
    products: row.product_ids.length ? row.product_ids : undefined,
    oncePerCustomer: row.max_per_customer === 1,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isActive: row.is_active,
    showOnSite: row.show_on_site,
    maxRedemptionsTotal: row.max_redemptions_total,
    maxPerCustomer: row.max_per_customer,
    firstOrderOnly: row.first_order_only,
    cities: row.cities,
    states: row.states,
    customerPhones: row.customer_phones,
    customerTypes: row.customer_types,
  };
}

/** The original hardcoded codes, as campaigns, for a database without the table. */
export const BUILT_IN_CAMPAIGNS: Campaign[] = COUPONS.map((rule, index) => ({
  ...rule,
  id: -(index + 1),
  name: rule.label,
  isActive: true,
  showOnSite: true,
  startsAt: null,
  endsAt: null,
  maxRedemptionsTotal: null,
  maxPerCustomer: rule.oncePerCustomer ? 1 : null,
  firstOrderOnly: false,
  cities: [],
  states: [],
  customerPhones: [],
  customerTypes: [],
}));

const isMissingTable = (error: unknown) => (error as { code?: string } | null)?.code === '42P01';

async function withFallback<T>(read: () => Promise<T>, fallback: () => T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isMissingTable(error) || isDatabaseUnavailable(error)) return fallback();
    throw error;
  }
}

export async function listCampaigns(): Promise<Campaign[]> {
  return withFallback(
    async () =>
      (await query<CampaignRow>(`SELECT ${COLUMNS} FROM campaigns ORDER BY is_active DESC, created_at DESC`)).map(
        toCampaign,
      ),
    () => BUILT_IN_CAMPAIGNS,
  );
}

/** Looked up fresh at checkout, never from a cache: a paused code stops at once. */
export async function findCampaign(code: string): Promise<Campaign | null> {
  const normalised = code.trim().toUpperCase();
  if (!normalised) return null;
  return withFallback(
    async () => {
      const row = await queryOne<CampaignRow>(`SELECT ${COLUMNS} FROM campaigns WHERE code = $1`, [normalised]);
      return row ? toCampaign(row) : null;
    },
    () => BUILT_IN_CAMPAIGNS.find((campaign) => campaign.code === normalised) ?? null,
  );
}

/* -------------------------------------------------------------- redemptions */

type Queryable = Pick<PoolClient, 'query'>;

/**
 * A redemption counts while its order is alive: not cancelled, and not an
 * unpaid order whose payment window has lapsed (no active reservation left).
 * Computed here rather than swept, so a customer whose payment failed gets
 * their single-use code back without anything having to run.
 */
const LIVE_REDEMPTIONS = `
  FROM coupon_redemptions r
  JOIN orders o ON o.id = r.order_id
 WHERE upper(r.code) = upper($1)
   AND o.status <> 'cancelled'
   AND NOT (
     o.status = 'pending_payment'
     AND o.payment_status <> 'paid'
     AND NOT EXISTS (
       SELECT 1 FROM stock_reservations s
        WHERE s.order_id = o.id
          AND (s.state = 'consumed' OR (s.state = 'active' AND s.expires_at > now()))
     )
   )`;

export async function countRedemptions(
  code: string,
  customer: { userId?: number | null; phone?: string | null },
  client?: Queryable,
): Promise<{ total: number; customer: number }> {
  const run = async (text: string, params: unknown[]) =>
    client ? (await client.query<{ total: number; customer: number }>(text, params)).rows : await query<{ total: number; customer: number }>(text, params);

  const phone = customer.phone ? phoneKey(customer.phone) : '';
  const [row] = await run(
    `SELECT count(*)::int AS total,
            count(*) FILTER (
              WHERE ($2::bigint IS NOT NULL AND r.user_id = $2)
                 OR ($3 <> '' AND right(regexp_replace(r.phone, '\\D', '', 'g'), 10) = $3)
            )::int AS customer
     ${LIVE_REDEMPTIONS}`,
    [code, customer.userId ?? null, phone],
  );
  return { total: row?.total ?? 0, customer: row?.customer ?? 0 };
}

/** A confirmed or paid order already exists for this account or phone. */
export async function hasPriorOrder(userId: number | null, phone: string | null): Promise<boolean> {
  const key = phone ? phoneKey(phone) : '';
  const row = await queryOne<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM orders
        WHERE (($1::bigint IS NOT NULL AND user_id = $1)
               OR ($2 <> '' AND right(regexp_replace(customer_phone, '\\D', '', 'g'), 10) = $2))
          AND (status IN ('confirmed', 'packed', 'shipped', 'delivered') OR payment_status = 'paid')
     ) AS exists`,
    [userId, key],
  );
  return Boolean(row?.exists);
}

export async function customerProfile(
  userId: number,
): Promise<{ phone: string | null; customerType: string | null }> {
  return withFallback(
    async () => {
      const row = await queryOne<{ phone: string | null; customer_type: string | null }>(
        'SELECT phone, customer_type FROM users WHERE id = $1',
        [userId],
      );
      return { phone: row?.phone ?? null, customerType: row?.customer_type ?? null };
    },
    () => ({ phone: null, customerType: null }),
  );
}

/**
 * Everything `campaignIneligibility` needs, read only for the rules this
 * campaign actually has — a code with no limits costs no queries.
 */
export async function eligibilityContext(
  campaign: Campaign,
  shopper: {
    userId?: number | null;
    phone?: string | null;
    city?: string;
    state?: string;
    final?: boolean;
  },
): Promise<EligibilityContext> {
  const context: EligibilityContext = {
    now: new Date(),
    final: shopper.final,
    city: shopper.city,
    state: shopper.state,
  };

  const profile =
    shopper.userId && (campaign.customerTypes.length || campaign.customerPhones.length || !shopper.phone)
      ? await customerProfile(shopper.userId)
      : null;
  const phone = shopper.phone ?? profile?.phone ?? undefined;
  if (phone) context.phone = phone;
  if (shopper.userId) context.customerType = profile?.customerType ?? null;

  const known = Boolean(shopper.userId || phone);
  if (known && (campaign.maxPerCustomer !== null || campaign.maxRedemptionsTotal !== null)) {
    const counts = await countRedemptions(campaign.code, { userId: shopper.userId, phone });
    context.customerRedemptions = counts.customer;
    context.totalRedemptions = counts.total;
  } else if (campaign.maxRedemptionsTotal !== null) {
    context.totalRedemptions = (await countRedemptions(campaign.code, {})).total;
  }
  if (known && campaign.firstOrderOnly) {
    context.hasPriorOrder = await hasPriorOrder(shopper.userId ?? null, phone ?? null);
  }
  return context;
}

/* -------------------------------------------------------------- admin writes */

/**
 * Several values: an array (each ticked box or picked item, as `getAll` gives
 * them — kept whole, so a name with a comma in it is never split), or typed
 * text, one per line or comma-separated.
 */
const list = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .default('')
  .transform((value) =>
    [...new Set((Array.isArray(value) ? value : value.split(/[\n,]+/)).map((item) => item.trim()))].filter(
      Boolean,
    ),
  );

const rupees = z
  .string()
  .trim()
  .optional()
  .default('')
  .transform((value) => (value === '' ? null : Math.round(Number(value.replace(/[₹,\s]/g, '')) * 100)))
  .refine((value) => value === null || (Number.isFinite(value) && value >= 0), 'Enter an amount in rupees.');

const count = z
  .string()
  .trim()
  .optional()
  .default('')
  .transform((value) => (value === '' ? null : Number(value)))
  .refine((value) => value === null || (Number.isInteger(value) && value > 0), 'Limits are whole numbers above 0.');

/** `datetime-local` input, read as India time (the business's clock). */
const istDate = z
  .string()
  .trim()
  .optional()
  .default('')
  .transform((value) => (value === '' ? null : new Date(`${value.length === 16 ? `${value}:00` : value}+05:30`)))
  .refine((value) => value === null || !Number.isNaN(value.getTime()), 'Enter a valid date.');

export const campaignInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, 'Code: 3–40 letters, digits, - or _, e.g. DIWALI25.'),
    name: z.string().trim().min(1, 'Enter a name.').max(120),
    label: z.string().trim().min(1, 'Enter the short offer line shown to shoppers.').max(120),
    description: z.string().trim().max(600).optional().default(''),
    kind: z.enum(['flat', 'percent', 'free-shipping']),
    /** Rupees for flat, a percentage for percent, ignored for free shipping. */
    amount: z.string().trim().optional().default(''),
    maxDiscount: rupees,
    minCart: rupees,
    categories: list,
    subcategories: list,
    productIds: list,
    startsAt: istDate,
    endsAt: istDate,
    isActive: z.boolean(),
    showOnSite: z.boolean(),
    firstOrderOnly: z.boolean(),
    maxRedemptionsTotal: count,
    maxPerCustomer: count,
    cities: list,
    states: list,
    customerPhones: list.transform((phones) => phones.map(phoneKey)),
    customerTypes: list,
  })
  .transform((input, ctx) => {
    let value = 0;
    if (input.kind === 'flat') {
      value = Math.round(Number(input.amount.replace(/[₹,\s]/g, '')) * 100);
      if (!Number.isFinite(value) || value <= 0) {
        ctx.addIssue({ code: 'custom', message: 'Enter the discount in rupees.' });
      }
    } else if (input.kind === 'percent') {
      value = Number(input.amount.replace('%', ''));
      if (!Number.isInteger(value) || value < 1 || value > 100) {
        ctx.addIssue({ code: 'custom', message: 'Enter a whole percentage from 1 to 100.' });
      }
    }
    if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
      ctx.addIssue({ code: 'custom', message: 'The end date must be after the start date.' });
    }
    if (input.customerPhones.some((phone) => phone.length !== 10)) {
      ctx.addIssue({ code: 'custom', message: 'Customer phone numbers must be 10-digit mobile numbers.' });
    }
    return { ...input, value };
  });

export type CampaignInput = z.output<typeof campaignInputSchema>;

export type CampaignWriteResult = { ok: true; id: number } | { ok: false; error: string };

function params(input: CampaignInput, actor: string): unknown[] {
  return [
    input.code,
    input.name,
    input.label,
    input.description,
    input.kind,
    input.value,
    input.maxDiscount,
    input.minCart,
    input.categories,
    input.subcategories,
    input.startsAt,
    input.endsAt,
    input.isActive,
    input.showOnSite,
    input.maxRedemptionsTotal,
    input.maxPerCustomer,
    input.firstOrderOnly,
    input.cities,
    input.states,
    input.customerPhones,
    input.customerTypes,
    actor,
    input.productIds,
  ];
}

function duplicate(error: unknown, code: string): CampaignWriteResult {
  if ((error as { code?: string }).code === '23505') {
    return { ok: false, error: `The code ${code} is already used by another campaign.` };
  }
  throw error;
}

export async function createCampaign(input: CampaignInput, actor: string): Promise<CampaignWriteResult> {
  try {
    const row = await queryOne<{ id: number }>(
      `INSERT INTO campaigns
         (code, name, label, description, kind, value, max_discount, min_cart, categories,
          subcategories, starts_at, ends_at, is_active, show_on_site, max_redemptions_total,
          max_per_customer, first_order_only, cities, states, customer_phones, customer_types,
          created_by, updated_by, product_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
               $19, $20, $21, $22, $22, $23)
       RETURNING id`,
      params(input, actor),
    );
    return { ok: true, id: row!.id };
  } catch (error) {
    return duplicate(error, input.code);
  }
}

export async function updateCampaign(
  id: number,
  input: CampaignInput,
  actor: string,
): Promise<CampaignWriteResult> {
  try {
    const row = await queryOne<{ id: number }>(
      `UPDATE campaigns
          SET code = $1, name = $2, label = $3, description = $4, kind = $5, value = $6,
              max_discount = $7, min_cart = $8, categories = $9, subcategories = $10,
              starts_at = $11, ends_at = $12, is_active = $13, show_on_site = $14,
              max_redemptions_total = $15, max_per_customer = $16, first_order_only = $17,
              cities = $18, states = $19, customer_phones = $20, customer_types = $21,
              updated_by = $22, product_ids = $23, updated_at = now()
        WHERE id = $24
        RETURNING id`,
      [...params(input, actor), id],
    );
    return row ? { ok: true, id: row.id } : { ok: false, error: 'That campaign no longer exists.' };
  } catch (error) {
    return duplicate(error, input.code);
  }
}

export async function setCampaignActive(id: number, active: boolean, actor: string): Promise<void> {
  await query('UPDATE campaigns SET is_active = $2, updated_by = $3, updated_at = now() WHERE id = $1', [
    id,
    active,
    actor,
  ]);
}

export async function findCampaignById(id: number): Promise<Campaign | null> {
  const row = await queryOne<CampaignRow>(`SELECT ${COLUMNS} FROM campaigns WHERE id = $1`, [id]);
  return row ? toCampaign(row) : null;
}

/** Live uses per code, for the admin list. */
export async function redemptionCounts(): Promise<Map<string, number>> {
  return withFallback(
    async () => {
      const rows = await query<{ code: string; uses: number }>(
        `SELECT upper(r.code) AS code, count(*)::int AS uses
           FROM coupon_redemptions r
           JOIN orders o ON o.id = r.order_id
          WHERE o.status <> 'cancelled'
          GROUP BY upper(r.code)`,
      );
      return new Map(rows.map((row) => [row.code, row.uses]));
    },
    () => new Map(),
  );
}

export async function setCustomerType(userId: number, customerType: string | null): Promise<void> {
  await query('UPDATE users SET customer_type = $2 WHERE id = $1', [userId, customerType]);
}

/* ------------------------------------------------------------- storefront */

export const CAMPAIGNS_TAG = 'campaigns';

/** What the storefront shows for a listed code: plain data, safe to serialise. */
export type SiteCoupon = Omit<CouponRule, 'categories'> & {
  categories?: string[];
  /** When the campaign ends (ISO), for the announcement bar's end date (R-09). */
  endsAt?: string;
};

const cachedCampaigns = unstable_cache(
  async () =>
    (await listCampaigns()).map((campaign) => ({
      ...campaign,
      startsAt: campaign.startsAt?.toISOString() ?? null,
      endsAt: campaign.endsAt?.toISOString() ?? null,
    })),
  ['campaigns-site'],
  // Five minutes, so a scheduled campaign appears close to its start time
  // even though nothing purges the cache at that moment.
  { tags: [CAMPAIGNS_TAG], revalidate: 300 },
);

/** Campaigns switched on, marked "show on site" and inside their dates. */
export async function listSiteCoupons(now = new Date()): Promise<SiteCoupon[]> {
  const campaigns = await cachedCampaigns().catch(() => []);
  return campaigns
    .map((campaign) => ({
      ...campaign,
      startsAt: campaign.startsAt ? new Date(campaign.startsAt) : null,
      endsAt: campaign.endsAt ? new Date(campaign.endsAt) : null,
    }))
    .filter((campaign) => isLiveOnSite(campaign, now))
    .map((campaign) => ({
      code: campaign.code,
      label: campaign.label,
      kind: campaign.kind,
      value: campaign.value,
      maxDiscount: campaign.maxDiscount,
      minCart: campaign.minCart,
      categories: campaign.categories,
      subcategories: campaign.subcategories,
      products: campaign.products,
      description: campaign.description,
      oncePerCustomer: campaign.oncePerCustomer,
      ...(campaign.endsAt ? { endsAt: campaign.endsAt.toISOString() } : {}),
    }));
}
