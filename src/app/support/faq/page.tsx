import type { Metadata } from 'next';
import { ALL_FAQS } from '@/lib/support/faqs';
import { SupportShell } from '@/components/support/support-shell';
import { FaqBrowser } from '@/components/support/faq-browser';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description:
    'Sizing, chemistry, delivery, installation, warranty, GST invoicing and returns — the questions we are asked most about iTarang power systems.',
  alternates: { canonical: '/support/faq' },
};

const FAQ_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: ALL_FAQS.map((entry) => ({
    '@type': 'Question',
    name: entry.question,
    acceptedAnswer: { '@type': 'Answer', text: entry.answer },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <SupportShell
        title="Frequently asked questions"
        intro="Straight answers on sizing, chemistry, delivery, installation, warranty and invoicing. If yours is not here, ask us — we answer every message."
        current="/support/faq"
      >
        <FaqBrowser />
      </SupportShell>
    </>
  );
}
