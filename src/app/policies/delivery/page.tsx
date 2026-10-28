import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import {
  PolicyDraftNotice,
  PolicySections,
  type PolicySection,
} from '@/components/support/policy-sections';
import { POLICIES_PUBLISHED } from '@/lib/site';
import { DELIVERY_CHARGE_NOTE } from '@/lib/store/totals';
import { DEFAULT_DELIVERY_DAYS, DELIVERY_DAYS_MIN } from '@/lib/support/serviceability';

export const metadata: Metadata = {
  title: 'Delivery policy',
  description: 'Where iTarang delivers, how long it takes, what it costs and what to check on arrival.',
  alternates: { canonical: '/policies/delivery' },
  robots: POLICIES_PUBLISHED ? undefined : { index: false, follow: false },
};

/**
 * Delivery policy (R-05). Areas served (D-04) and the delivery charge (D-03)
 * are still open with business, so the page points to the live pincode check
 * and the cart rather than stating either. Needs sign-off before publishing.
 */
const SECTIONS: PolicySection[] = [
  {
    id: 'areas',
    title: 'Where we deliver',
    paragraphs: [
      'Enter your pincode on any product page to see whether we deliver there and the expected date. We only accept orders for pincodes we can deliver to and service after sale.',
    ],
  },
  {
    id: 'time',
    title: 'How long it takes',
    points: [
      `Most orders are delivered within ${DELIVERY_DAYS_MIN}–${DEFAULT_DELIVERY_DAYS} working days of payment; the pincode check shows the estimate for your area.`,
      'Orders are packed and handed to the courier on working days. Sundays and public holidays are not counted.',
      'The courier name and tracking details appear on your order page once it ships.',
    ],
  },
  {
    id: 'charges',
    title: 'Delivery charges',
    paragraphs: [`${DELIVERY_CHARGE_NOTE} There is no minimum order value, and batteries ship in protective crates at no extra charge.`],
  },
  {
    id: 'arrival',
    title: 'On delivery',
    points: [
      'Check the crate before you sign. If it is visibly damaged, note it on the delivery receipt or refuse the delivery.',
      'Report any damage, fault or wrong item within 48 hours of delivery, with photos — see the Refund & Return Policy.',
      'Someone at the address must be available to receive the order; a battery may need two people to lift.',
    ],
  },
  {
    id: 'failed',
    title: 'If delivery fails',
    paragraphs: [
      'The courier attempts delivery again or calls the mobile number on the order. If the order cannot be delivered after repeated attempts, it returns to us and we refund the product price.',
    ],
  },
  {
    id: 'installation',
    title: 'Installation',
    paragraphs: [
      'Delivery does not include installation unless the product page says so. Your own qualified electrician or mechanic may install the battery.',
    ],
  },
];

export default function DeliveryPolicyPage() {
  return (
    <SupportShell
      title="Delivery policy"
      intro="Where we deliver, how long it takes, what it costs, and what to check when your battery arrives."
      current="/policies/delivery"
    >
      {POLICIES_PUBLISHED ? null : <PolicyDraftNotice />}
      <PolicySections sections={SECTIONS} updated="28 October 2026" />
    </SupportShell>
  );
}
