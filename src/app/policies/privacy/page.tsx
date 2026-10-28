import type { Metadata } from 'next';
import { SupportShell } from '@/components/support/support-shell';
import {
  PolicyDraftNotice,
  PolicySections,
  type PolicySection,
} from '@/components/support/policy-sections';
import { POLICIES_PUBLISHED, SITE } from '@/lib/site';
import { GRIEVANCE_OFFICER } from '@/lib/support/contacts';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What personal data iTarang collects through the store, why, and your rights over it.',
  alternates: { canonical: '/policies/privacy' },
  robots: POLICIES_PUBLISHED ? undefined : { index: false, follow: false },
};

/**
 * Privacy policy (R-05, D-18). Same section order as Livguard's privacy page,
 * the model the business chose, written for what this store actually collects
 * and who it actually shares it with. Framed on the Digital Personal Data
 * Protection Act, 2023. Needs legal sign-off before `POLICIES_PUBLISHED`.
 */
const SECTIONS: PolicySection[] = [
  {
    id: 'who',
    title: 'Who we are',
    paragraphs: [
      `${SITE.legalName}, ${SITE.address}, operates this store and decides how the personal data collected through it is used.`,
    ],
  },
  {
    id: 'collect',
    title: 'What we collect',
    points: [
      'Contact details: your name, mobile number and email address.',
      'Delivery details: your address, pincode and, if you ask for a GST invoice, your GSTIN.',
      'Order details: what you bought, amounts, and the payment reference and status from our payment gateway. We never receive your full card or UPI details.',
      'Support requests: what you tell us in a complaint, warranty registration or enquiry, including photos you send.',
      'Technical data: your device, browser and pages visited, through cookies needed to run the cart and sign-in.',
    ],
  },
  {
    id: 'use',
    title: 'Why we use it',
    points: [
      'To take, deliver, invoice and support your order, and to handle returns, refunds and warranty claims.',
      'To send you order updates by SMS, WhatsApp, email or phone, as you agree to at checkout.',
      'To keep the store secure and to prevent fraud.',
      'To meet our legal duties, including GST and accounting records.',
      'To send offers, only if you separately agree. You can stop them at any time.',
    ],
  },
  {
    id: 'share',
    title: 'Who we share it with',
    paragraphs: [
      'We share only what each needs to do its job: our payment gateway (Razorpay), courier and delivery partners, the manufacturer (Trontek) for warranty service, our messaging and email providers, and our hosting and database providers. We do not sell your personal data. We disclose it to authorities only where the law requires.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    paragraphs: [
      'The store uses cookies to keep your cart, remember your pincode and keep you signed in. Blocking them may stop the cart or checkout from working.',
    ],
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    paragraphs: [
      'Order and invoice records are kept for as long as tax law requires (currently eight years). Other data is kept while your account is open or while it is needed for the purpose it was collected, then deleted.',
    ],
  },
  {
    id: 'security',
    title: 'How we protect it',
    paragraphs: [
      'Data is sent over encrypted connections, invoices are stored privately and shown only to you and our staff, and access is limited to the people who need it.',
    ],
  },
  {
    id: 'rights',
    title: 'Your rights',
    points: [
      'Ask what personal data we hold about you and how it is used.',
      'Ask us to correct or update it, or to erase it where we no longer need to keep it.',
      'Withdraw consent to messages; order updates already in progress may still be sent.',
      'Nominate someone to exercise these rights on your behalf.',
      'Raise a grievance with us, and then with the Data Protection Board of India.',
    ],
  },
  {
    id: 'children',
    title: 'Children',
    paragraphs: ['The store is not meant for anyone under 18, and we do not knowingly collect their data.'],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: [
      `Write to our grievance officer, ${GRIEVANCE_OFFICER.person ?? ''}${GRIEVANCE_OFFICER.email ? `, at ${GRIEVANCE_OFFICER.email}` : ''}, for any privacy question or request.`,
    ],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    paragraphs: ['If we change this policy we update the date below; significant changes are notified on the store.'],
  },
];

export default function PrivacyPage() {
  return (
    <SupportShell
      title="Privacy policy"
      intro="What personal data we collect when you shop with us, why we use it, who sees it, and how to exercise your rights."
      current="/policies/privacy"
    >
      {POLICIES_PUBLISHED ? null : <PolicyDraftNotice />}
      <PolicySections sections={SECTIONS} updated="28 October 2026" />
    </SupportShell>
  );
}
