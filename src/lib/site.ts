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
      { label: 'Inverters', href: '/c/inverters' },
      { label: 'Batteries', href: '/c/batteries' },
      { label: 'UPS systems', href: '/c/ups' },
      { label: 'Inverter + battery combos', href: '/c/combos' },
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
  icon: 'truck' | 'shield' | 'wallet' | 'wrench';
  title: string;
  detail: string;
}

/** Claims here are deliberately conservative and tied to documented policy. */
export const TRUST_ITEMS: TrustItem[] = [
  {
    icon: 'truck',
    title: 'Free delivery above ₹4,999',
    detail: 'Batteries ship crated at no extra charge.',
  },
  {
    icon: 'shield',
    title: 'Documented warranty',
    detail: 'Written terms with every product, from 2 to 5 years.',
  },
  {
    icon: 'wallet',
    title: 'Pay on delivery',
    detail: 'Available on eligible orders and pincodes.',
  },
  {
    icon: 'wrench',
    title: 'Certified installation',
    detail: 'Included on inverters, batteries and combos.',
  },
];
