/**
 * Site-wide configuration.
 *
 * DEVELOPMENT PLACEHOLDERS — every value marked `PLACEHOLDER` below is carried
 * over from the current Hostinger storefront or stands in for information we do
 * not have yet. None of them should go live without being confirmed:
 *   - phone number (the live site currently shows an unformatted placeholder)
 *   - registered address, GSTIN, CIN
 *   - support hours
 *   - service network coverage claim
 */
import { categoryPath } from '@/lib/routes';

export const SITE = {
  name: 'iTarang Products',
  shortName: 'iTarang',
  tagline: 'Pure sine wave power backup for Indian homes',
  description:
    'iTarang builds silent pure sine wave inverters, long-life lithium and tubular batteries, UPS systems and ready-to-install combos — with certified installation and documented warranty.',
  url: 'https://itarang.in',
  email: 'care@itarang.in',
  /** PLACEHOLDER — carried over from the current storefront footer. */
  phone: '+91 90000 00000',
  phoneHref: 'tel:+919000000000',
  /** PLACEHOLDER — confirm before launch. */
  whatsapp: 'https://wa.me/919000000000',
  /** PLACEHOLDER — confirm hours with the support team. */
  supportHours: 'Mon – Sat, 9:00 AM – 7:00 PM',
  /** PLACEHOLDER — registered office address required for GST invoices. */
  address: 'Registered address to be confirmed',
} as const;

export interface NavChild {
  label: string;
  href: string;
  description?: string;
}

export interface NavGroup {
  label: string;
  href: string;
  children: NavChild[];
}

/**
 * Header navigation.
 *
 * Category families are generated from the catalogue taxonomy in
 * `components/layout/mega-menu.tsx`; this covers the non-catalogue entries.
 */
export const UTILITY_LINKS: NavChild[] = [
  { label: 'Track order', href: '/track' },
  { label: 'Support', href: '/support' },
  { label: 'Load calculator', href: '/tools/load-calculator' },
];

export const SECONDARY_NAV: NavChild[] = [
  { label: 'Offers', href: '/offers' },
  { label: 'Load calculator', href: '/tools/load-calculator' },
  { label: 'Support', href: '/support' },
];

export const FOOTER_COLUMNS: NavGroup[] = [
  {
    label: 'Shop',
    href: '/search',
    children: [
      { label: 'Inverters', href: categoryPath('inverters') },
      { label: 'Batteries', href: categoryPath('batteries') },
      { label: 'UPS systems', href: categoryPath('ups') },
      { label: 'Inverter + battery combos', href: categoryPath('combos') },
      { label: 'Offers', href: '/offers' },
      { label: 'Compare products', href: '/compare' },
    ],
  },
  {
    // Reduced to complaint registration only. Warranty registration,
    // installation booking, technician lookup and order tracking have been
    // withdrawn from the after-sales navigation; their routes still exist and
    // still work when visited directly.
    label: 'Owner centre',
    href: '/support',
    children: [{ label: 'Register a complaint', href: '/support/complaint' }],
  },
  {
    label: 'Help',
    href: '/support',
    children: [
      { label: 'Support hub', href: '/support' },
      { label: 'Frequently asked questions', href: '/support/faq' },
      { label: 'Load calculator', href: '/tools/load-calculator' },
      { label: 'Your account', href: '/account' },
      { label: 'Delivery & installation', href: '/support/faq#delivery' },
    ],
  },
];

export const POLICY_LINKS: NavChild[] = [
  { label: 'Warranty terms', href: '/support/faq#warranty' },
  { label: 'Returns & replacement', href: '/support/faq#returns' },
  { label: 'Delivery information', href: '/support/faq#delivery' },
  { label: 'Offer terms', href: '/offers#terms' },
];

export interface TrustItem {
  icon: 'shield' | 'factory' | 'phone' | 'recycle';
  title: string;
  detail: string;
}

/**
 * The four claims on the strip under the hero, and the source of each.
 *
 * These appear on the homepage, above the fold, on every visit — so they are
 * the most-read sentences on the site and the ones least able to carry a guess.
 * Each is checkable against the catalogue or the seller record:
 *
 * 1. `facets.technology` is `LiFePO4` on all eight products, and every one
 *    lists an intelligent BMS among its key features.
 * 2. `countryOfOrigin` is `India` on all eight, brand `TRONTEK`, and the
 *    manufacturer record's country of origin is India.
 * 3. `SELLERS[0].customerCarePhone` and `grievanceOfficerName` — the same
 *    number and named officer the product pages print.
 * 4. Every product's closing FAQ states the take-back programme under the
 *    Battery Waste Management Rules, 2022.
 *
 * **What was here before, and why it went.** Four claims, all four contradicted
 * by the catalogue they sat above: "Free delivery above ₹4,999" (no delivery
 * policy exists anywhere in the catalogue), "Documented warranty — written
 * terms with every product, from 2 to 5 years" (six of the eight products state
 * no warranty at all, which `seed-data.test.ts` exists to keep true, and the two
 * that do say 5 years and 3 years), "Pay on delivery" (checkout is not open) and
 * "Certified installation — included on inverters, batteries and combos"
 * (`installationIncluded` is false on all eight). A trust strip that cannot be
 * checked against the catalogue is the opposite of one.
 *
 * Copy only. No delivery, COD, checkout or payment code is touched by this —
 * those remain switched off exactly as they were.
 */
export const TRUST_ITEMS: TrustItem[] = [
  {
    icon: 'shield',
    title: 'Lithium iron phosphate',
    detail: 'Every battery we list is LFP with an intelligent BMS.',
  },
  {
    icon: 'factory',
    title: 'Made in India',
    detail: 'Manufactured by Trontek, with in-house R&D and testing.',
  },
  {
    icon: 'phone',
    title: 'A person to call',
    detail: 'Customer care on 9971027907, and a named grievance officer.',
  },
  {
    icon: 'recycle',
    title: 'Battery take-back',
    detail: 'Recycled under the Battery Waste Management Rules, 2022.',
  },
];