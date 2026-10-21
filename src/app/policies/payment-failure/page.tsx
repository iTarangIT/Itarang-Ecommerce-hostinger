import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import { PolicySections, type PolicySection } from '@/components/support/policy-sections';
import { ITARANG_CARE } from '@/lib/support/contacts';

export const metadata: Metadata = {
  title: 'Payment failure policy',
  description:
    'What to do if a payment fails, is debited twice, or your order does not confirm after paying.',
  alternates: { canonical: '/policies/payment-failure' },
};

/**
 * What a customer reads when a payment goes wrong. Standard wording, as the
 * business asked. It describes what the checkout actually does: an order is
 * held while payment is pending, the stock is reserved, and a payment that
 * arrives later is matched to the order by the gateway's notification.
 */
const SECTIONS: PolicySection[] = [
  {
    id: 'failed',
    title: 'Payment failed and no money was deducted',
    paragraphs: [
      'Nothing has been charged. Your order stays held for a short while — open it from your account or the confirmation link and try the payment again, by the same method or another one.',
    ],
  },
  {
    id: 'debited',
    title: 'Payment failed but money was deducted',
    points: [
      'Do not pay again straight away. Banks sometimes confirm a payment a few minutes late.',
      'If the payment reaches us within 30 minutes, your order is confirmed automatically and you receive a confirmation.',
      'If it does not, the debit is reversed to the same account automatically. This usually takes 5–7 working days, depending on your bank.',
      'If you still have not received the reversal after 7 working days, contact us with your order number and the transaction reference from your bank or UPI app.',
    ],
  },
  {
    id: 'double',
    title: 'Charged twice for one order',
    paragraphs: [
      'Only one payment is applied to an order. A second, duplicate payment is refunded in full to the original payment method within 5–7 working days. If it has not arrived by then, contact us with both transaction references.',
    ],
  },
  {
    id: 'pending',
    title: 'Order shows "awaiting payment" after paying',
    paragraphs: [
      'This means the payment gateway has not yet told us the payment succeeded. It normally resolves within minutes. If it has not changed after an hour, contact us — do not place the order again.',
    ],
  },
  {
    id: 'upi',
    title: 'UPI discount on a retried payment',
    paragraphs: [
      'The ₹200 UPI discount stays on the order when you retry, as long as the retry is also paid by UPI.',
    ],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [
      `${ITARANG_CARE.label}: ${ITARANG_CARE.phone ?? ''}${ITARANG_CARE.email ? `, ${ITARANG_CARE.email}` : ''}. Keep your order number and the transaction reference ready; it lets us trace the payment in one call.`,
    ],
  },
];

export default function PaymentFailurePolicyPage() {
  return (
    <SupportShell
      title="Payment failure policy"
      intro="A payment that fails, is debited twice, or does not confirm — what happens to your money, and what to do."
      current="/policies/payment-failure"
    >
      <PolicySections sections={SECTIONS} updated="17 October 2026" />
    </SupportShell>
  );
}
