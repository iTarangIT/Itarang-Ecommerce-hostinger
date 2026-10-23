/**
 * Site-wide configuration.
 *
 * DEVELOPMENT PLACEHOLDERS — every value marked `PLACEHOLDER` below is carried
 * over from the current Hostinger storefront or stands in for information we do
 * not have yet. None of them should go live without being confirmed:
 *   - registered address, GSTIN, CIN
 *   - support hours
 *   - service network coverage claim
 */

export const SITE = {
  name: 'iTarang Products',
  shortName: 'iTarang',
  tagline: 'Pure sine wave power backup for Indian homes',
  description:
    'iTarang builds silent pure sine wave inverters, long-life lithium and tubular batteries, UPS systems and ready-to-install combos — with certified installation and documented warranty.',
  url: 'https://itarang.in',
  email: 'care@itarang.com',
  phone: '+91-8076841497',
  phoneHref: 'tel:+918076841497',
  whatsapp: 'https://wa.me/918076841497',
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
 * Categories sit under the single "All products" dropdown in
 * `components/layout/mega-menu.tsx`; this covers the non-catalogue entries.
 */
export const UTILITY_LINKS: NavChild[] = [
  { label: 'Track order', href: '/track' },
  { label: 'Find a dealer', href: '/support/dealers' },
  { label: 'Check price', href: '/pricing' },
  { label: 'Support', href: '/support' },
];

// "All products" is not listed here: it is the category dropdown that opens
// the header (`components/layout/mega-menu.tsx`).
export const SECONDARY_NAV: NavChild[] = [
  { label: 'Offers', href: '/offers' },
  // Short labels: this row shares the header with the category menus.
  { label: 'Load calculator', href: '/tools/load-calculator' },
  { label: 'EV calculator', href: '/tools/mobility-calculator' },
  { label: 'Support', href: '/support' },
];

export const FOOTER_COLUMNS: NavGroup[] = [
  {
    label: 'Shop',
    href: '/search',
    children: [
      // The category links above these are added by `Footer` from the live
      // navigation (`footerCategoryLinks`), so a category added in the admin
      // panel appears here too, and an empty one never does.
      { label: 'Check price', href: '/pricing' },
      { label: 'Offers', href: '/offers' },
      { label: 'Compare products', href: '/compare' },
    ],
  },
  {
    label: 'Owner centre',
    href: '/support',
    children: [
      { label: 'Register a complaint', href: '/support/complaint' },
      { label: 'Register your warranty', href: '/support/warranty-registration' },
      { label: 'Find a dealer', href: '/support/dealers' },
      { label: 'Track your order', href: '/track' },
    ],
  },
  {
    label: 'Help & tools',
    href: '/support',
    children: [
      { label: 'Support hub', href: '/support' },
      { label: 'Frequently asked questions', href: '/support/faq' },
      { label: 'Home load calculator', href: '/tools/load-calculator' },
      { label: 'EV battery calculator', href: '/tools/mobility-calculator' },
      { label: 'Brochures & spec sheets', href: '/downloads' },
      { label: 'Blog', href: '/blog' },
    ],
  },
];

export const POLICY_LINKS: NavChild[] = [
  { label: 'Refund & returns', href: '/policies/refund' },
  { label: 'Payment failure', href: '/policies/payment-failure' },
  { label: 'Warranty terms', href: '/support/faq#warranty' },
  { label: 'Delivery information', href: '/support/faq#delivery' },
  { label: 'Offer terms', href: '/offers#terms' },
  { label: 'Grievance officer', href: '/support/grievance' },
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