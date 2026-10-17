import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import { PolicySections, type PolicySection } from '@/components/support/policy-sections';
import { ITARANG_CARE } from '@/lib/support/contacts';

export const metadata: Metadata = {
  title: 'Refund & return policy',
  description:
    'How returns, replacements, cancellations and refunds work for orders placed on iTarang.',
  alternates: { canonical: '/policies/refund' },
};

/**
 * The refund and return policy, in the standard form the business asked for
 * ("Mention policy around refund, payment fail etc. use standard replies").
 * The time limits are the common e-commerce defaults; change them here.
 */
const SECTIONS: PolicySection[] = [
  {
    id: 'damaged',
    title: 'Damaged, faulty or wrong products',
    paragraphs: [
      'If your order arrives damaged, does not work, or is not what you ordered, tell us within 48 hours of delivery. Send your order number with photos of the product and the packaging.',
      'Once we have confirmed the problem we replace the product at no cost, or refund it in full if a replacement is not available.',
    ],
  },
  {
    id: 'returns',
    title: 'Returning a product you no longer want',
    points: [
      'Unused products can be returned within 7 days of delivery.',
      'The product must be in its original sealed packaging, with all accessories, manuals and the invoice.',
      'A battery that has been installed, charged or connected cannot be returned for change of mind, for safety reasons. It is still covered by its warranty.',
      'Return pickup is arranged by us. The delivery charge, if one was paid, is not refunded on a change-of-mind return.',
    ],
  },
  {
    id: 'cancellation',
    title: 'Cancelling an order',
    paragraphs: [
      'You can cancel free of charge until the order is dispatched. Call customer care with your order number. A cancelled prepaid order is refunded in full.',
      'Once an order has been dispatched it can no longer be cancelled; refuse the delivery or follow the return process above.',
    ],
  },
  {
    id: 'refunds',
    title: 'How and when refunds are paid',
    points: [
      'Refunds go back to the original payment method — the same UPI account, card or bank account.',
      'We start the refund within 2 working days of approving it. Your bank or card issuer usually credits it within 5–7 working days.',
      'Discounts are deducted from the refund: if you return part of an order that used a coupon or the UPI discount, the refund is the amount you actually paid for that item.',
      'Cash-on-delivery orders, where offered, are refunded by bank transfer to an account you give us.',
    ],
  },
  {
    id: 'warranty',
    title: 'Warranty claims are separate',
    paragraphs: [
      'A fault that appears after the return window is a warranty claim, not a return. The warranty period is stated on each product page. Register a complaint and we arrange the claim with Trontek.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [
      `${ITARANG_CARE.label}: ${ITARANG_CARE.phone ?? ''}${ITARANG_CARE.email ? `, ${ITARANG_CARE.email}` : ''}. If you are not satisfied with how a refund was handled, you can write to our grievance officer.`,
    ],
  },
];

export default function RefundPolicyPage() {
  return (
    <SupportShell
      title="Refund & return policy"
      intro="What happens if something arrives damaged, if you change your mind, or if you cancel — and how quickly your money comes back."
      current="/policies/refund"
    >
      <PolicySections sections={SECTIONS} updated="17 October 2026" />
    </SupportShell>
  );
}
