import type { Metadata } from 'next';
import { Mail, Phone, UserRound } from 'lucide-react';
import { SupportShell } from '@/components/support/support-shell';
import { PolicySections, type PolicySection } from '@/components/support/policy-sections';
import {
  GRIEVANCE_ACK_HOURS,
  GRIEVANCE_OFFICER,
  GRIEVANCE_RESOLVE_DAYS,
  telHref,
} from '@/lib/support/contacts';

export const metadata: Metadata = {
  title: 'Grievance officer',
  description:
    'Contact details of the iTarang grievance officer, and how complaints are escalated and resolved.',
  alternates: { canonical: '/support/grievance' },
};

/**
 * The grievance officer page required of an e-commerce seller under the
 * Consumer Protection (E-Commerce) Rules, 2020: name, contact details, and the
 * acknowledgement and resolution timelines (48 hours and one month).
 */
const SECTIONS: PolicySection[] = [
  {
    id: 'when',
    title: 'When to write to the grievance officer',
    paragraphs: [
      'Most problems are fastest through customer care or a complaint registered on this site. Write to the grievance officer if a complaint has not been resolved, or if you are unhappy with how it was handled.',
    ],
  },
  {
    id: 'include',
    title: 'What to include',
    points: [
      'Your name and the phone number on the order',
      'The order number, and the complaint reference if you have one',
      'What went wrong and what you would like us to do',
    ],
  },
  {
    id: 'timelines',
    title: 'Timelines',
    points: [
      `Your grievance is acknowledged within ${GRIEVANCE_ACK_HOURS} hours of receipt.`,
      `It is resolved within ${GRIEVANCE_RESOLVE_DAYS} days, and you are told the outcome in writing.`,
    ],
  },
];

export default function GrievancePage() {
  const officer = GRIEVANCE_OFFICER;
  const tel = telHref(officer.phone);

  return (
    <SupportShell
      title="Grievance officer"
      intro="If a complaint has not been resolved to your satisfaction, our grievance officer will look at it personally."
      current="/support/grievance"
    >
      <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-5 sm:p-6">
        <p className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          <UserRound className="h-5 w-5 text-primary" />
          {officer.person}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">Grievance officer, iTarang Network Private Limited</p>
        <ul className="mt-4 space-y-2 text-sm">
          {officer.phone && tel ? (
            <li>
              <a href={tel} className="inline-flex items-center gap-2 font-semibold text-foreground hover:text-accent-600">
                <Phone className="h-4 w-4 text-accent-600" />
                {officer.phone}
              </a>
            </li>
          ) : null}
          {officer.email ? (
            <li>
              <a
                href={`mailto:${officer.email}?subject=${encodeURIComponent('Grievance')}`}
                className="inline-flex items-center gap-2 text-foreground hover:text-accent-600"
              >
                <Mail className="h-4 w-4 text-accent-600" />
                {officer.email}
              </a>
            </li>
          ) : null}
        </ul>
        {officer.note ? <p className="mt-3 text-xs text-muted-foreground">{officer.note}</p> : null}
      </div>

      <PolicySections sections={SECTIONS} updated="17 October 2026" />
    </SupportShell>
  );
}
