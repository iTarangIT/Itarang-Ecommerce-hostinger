/**
 * Site-wide configuration.
 *
 * Values marked `PLACEHOLDER` are waiting on business (task R-20 in the
 * 27 Oct store tracker). A placeholder is empty, and the components that
 * show it leave the line out rather than print a guess.
 *   - GSTIN (R-20)
 */

/** Marks a value that business has not confirmed yet. */
export const PLACEHOLDER = '';

export const SITE = {
  name: 'iTarang Products',
  shortName: 'iTarang',
  tagline: 'Lithium batteries for EVs and home backup',
  description:
    'Lithium iron phosphate (LFP) batteries for e-rickshaws, two-wheelers and home inverters, made in India by Trontek and sold online by iTarang.',
  url: 'https://shop.itarang.com',
  legalName: 'iTarang Network Private Limited',
  email: 'care@itarang.com',
  /**
   * The one customer-care number (D-09, confirmed 28 Oct). It is the
   * seller record's number, so the header, footer, trust row, support pages
   * and product pages all print the same one. `lib/support/contacts.ts`
   * carries it in display form.
   */
  phone: '+91-9971027907',
  phoneHref: 'tel:+919971027907',
  /** WhatsApp chat link; which number sends store messages is D-14. */
  whatsapp: 'https://wa.me/918076841497',
  /** Support hours (D-09, confirmed 28 Oct). Empty hides the line. */
  supportHours: 'Mon–Sat, 10 am – 7 pm' as string,
  /** Registered office, from store row S-07 (27 Oct tracker). */
  address: 'Unitech Business Zone, Sector 50, Gurugram, Haryana',
  /** PLACEHOLDER (R-20) — GSTIN for the footer and policy pages. Empty hides it. */
  gstin: PLACEHOLDER as string,
} as const;

/**
 * PLACEHOLDER (R-09) — when the WELCOME offers end, `YYYY-MM-DD`, for the
 * announcement bar. Business to give the date; a campaign's own end date in
 * /admin/campaigns wins when set. Empty shows no date.
 */
export const WELCOME_OFFER_ENDS: string = PLACEHOLDER;

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

/**
 * Terms, Privacy and Delivery pages (R-05) are drafted but wait for legal
 * sign-off (Chirag, B-06). While false they carry a "draft" banner, are kept
 * out of search engines, the footer and the sitemap, and the checkout tick
 * covers the refund policy and order updates only. Set to true once signed off.
 */
export const POLICIES_PUBLISHED = false;

export const POLICY_LINKS: NavChild[] = [
  ...(POLICIES_PUBLISHED
    ? [
        { label: 'Terms & conditions', href: '/policies/terms' },
        { label: 'Privacy policy', href: '/policies/privacy' },
        { label: 'Delivery policy', href: '/policies/delivery' },
      ]
    : [{ label: 'Delivery information', href: '/support/faq#delivery' }]),
  { label: 'Refund & returns', href: '/policies/refund' },
  { label: 'Payment failure', href: '/policies/payment-failure' },
  { label: 'Warranty terms', href: '/support/faq#warranty' },
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
 * 3. `SITE.phone`, the one customer-care number used in the header, footer
 *    and WhatsApp link (D-09), and the grievance officer page.
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
    detail: `Customer care on ${SITE.phone.replace(/^\+91-/, '')}, and a named grievance officer.`,
  },
  {
    icon: 'recycle',
    title: 'Battery take-back',
    detail: 'Recycled under the Battery Waste Management Rules, 2022.',
  },
];