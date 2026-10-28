import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import {
  PolicyDraftNotice,
  PolicySections,
  type PolicySection,
} from '@/components/support/policy-sections';
import { POLICIES_PUBLISHED, SITE } from '@/lib/site';
import { GRIEVANCE_OFFICER, ITARANG_CARE } from '@/lib/support/contacts';

export const metadata: Metadata = {
  title: 'Terms & conditions',
  description: 'The terms on which iTarang sells lithium batteries through shop.itarang.com.',
  alternates: { canonical: '/policies/terms' },
  robots: POLICIES_PUBLISHED ? undefined : { index: false, follow: false },
};

/**
 * Terms of sale (R-05, D-18). Laid out on the same sections as Livguard's
 * terms page, which the business chose as the model, but written for iTarang:
 * our entity, our products, our warranty and delivery terms. None of
 * Livguard's text is used. Needs legal sign-off before `POLICIES_PUBLISHED`.
 */
const SECTIONS: PolicySection[] = [
  {
    id: 'about',
    title: 'About these terms',
    paragraphs: [
      `${SITE.url.replace(/^https?:\/\//, '')} ("the store") is operated by ${SITE.legalName}, ${SITE.address}${SITE.gstin ? ` (GSTIN ${SITE.gstin})` : ''} ("iTarang", "we", "us").`,
      'These terms apply to every order placed on the store. By placing an order you confirm you have read and accept them, together with our Privacy Policy, Delivery Policy and Refund & Return Policy.',
    ],
  },
  {
    id: 'eligibility',
    title: 'Who can buy',
    points: [
      'You must be at least 18 years old and able to enter into a binding contract under Indian law.',
      'Orders are accepted for delivery to addresses in India only, in the areas our delivery check confirms.',
      'You are responsible for the accuracy of the name, mobile number, address and GSTIN you give us.',
    ],
  },
  {
    id: 'products',
    title: 'Products and descriptions',
    paragraphs: [
      'The batteries and chargers on the store are manufactured by Trontek and sold by iTarang. We describe each product, its specifications and its warranty as printed by the manufacturer. Images are for illustration; the specification sheet on each product page is the reference.',
      'Choosing the right battery for a vehicle or inverter is your responsibility. Our load calculator and support team can help, but their suggestions are guidance, not a guarantee of fit.',
    ],
  },
  {
    id: 'prices',
    title: 'Prices and offers',
    points: [
      'Prices are in Indian rupees and include GST. Any delivery charge is shown in the cart before you pay.',
      'Offers and coupon codes apply only on their stated terms and dates and cannot be exchanged for cash.',
      'If a product is listed at an obviously wrong price because of an error, we may cancel the order and refund you in full before it is dispatched.',
    ],
  },
  {
    id: 'orders',
    title: 'Placing an order',
    paragraphs: [
      'An order is confirmed when we have received your payment and sent you an order confirmation. We may decline or cancel an order — for example if the product is out of stock, the delivery address cannot be served, or we suspect fraud — and in that case any amount paid is refunded in full.',
    ],
  },
  {
    id: 'payment',
    title: 'Payment',
    paragraphs: [
      'Payments are processed by our payment gateway, Razorpay. We do not see or store your card details. If money is deducted but the order is not confirmed, our Payment Failure Policy explains how it is returned.',
    ],
  },
  {
    id: 'delivery',
    title: 'Delivery',
    paragraphs: [
      'Delivery areas, timelines and charges are set out in our Delivery Policy. Ownership and risk in the product pass to you on delivery.',
    ],
  },
  {
    id: 'returns',
    title: 'Cancellation, returns and refunds',
    paragraphs: [
      'You can cancel before dispatch. Damaged, faulty or wrong products, change-of-mind returns and refund timelines are covered by our Refund & Return Policy.',
    ],
  },
  {
    id: 'warranty',
    title: 'Warranty and installation',
    points: [
      'Each product carries the manufacturer’s warranty stated on its product page and invoice. Keep your invoice; it is needed for any warranty claim.',
      'The warranty does not cover damage from incorrect installation, use with an incompatible charger or inverter, physical damage, water ingress, or opening the battery.',
      'Installation is not included unless the product page says so. Your own qualified electrician or mechanic may install the product.',
    ],
  },
  {
    id: 'liability',
    title: 'Our liability',
    paragraphs: [
      'Nothing in these terms limits rights you have under the Consumer Protection Act, 2019. Beyond those rights, our liability for any order is limited to the amount you paid for it, and we are not liable for indirect or consequential loss, including loss of business or income.',
    ],
  },
  {
    id: 'use',
    title: 'Use of the store',
    paragraphs: [
      'The content, logos and images on the store belong to iTarang or Trontek and may not be copied for commercial use. You agree not to misuse the store, attempt to break its security, or place orders in someone else’s name without their consent.',
    ],
  },
  {
    id: 'messages',
    title: 'Order updates',
    paragraphs: [
      'When you place an order you agree that we may contact you on the mobile number and email you give — by SMS, WhatsApp, email or phone — about that order, its delivery, warranty and support. Promotional messages are sent only if you separately agree to them.',
    ],
  },
  {
    id: 'law',
    title: 'Governing law and disputes',
    paragraphs: [
      'These terms are governed by the laws of India. Courts at Gurugram, Haryana have jurisdiction, without affecting your right to approach a consumer commission where you live.',
    ],
  },
  {
    id: 'grievance',
    title: 'Contact and grievances',
    paragraphs: [
      `${ITARANG_CARE.label}: ${ITARANG_CARE.phone ?? ''}${ITARANG_CARE.email ? `, ${ITARANG_CARE.email}` : ''}.`,
      `Grievance officer: ${GRIEVANCE_OFFICER.person ?? ''}${GRIEVANCE_OFFICER.email ? `, ${GRIEVANCE_OFFICER.email}` : ''}. See the grievance officer page for timelines.`,
    ],
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    paragraphs: [
      'We may update these terms. The version on this page when you place an order is the one that applies to it.',
    ],
  },
];

export default function TermsPage() {
  return (
    <SupportShell
      title="Terms & conditions"
      intro="The terms on which iTarang sells through this store — who can buy, prices, payment, delivery, warranty and how disputes are handled."
      current="/policies/terms"
    >
      {POLICIES_PUBLISHED ? null : <PolicyDraftNotice />}
      <PolicySections sections={SECTIONS} updated="28 October 2026" />
    </SupportShell>
  );
}
