import type { Metadata } from 'next';
import { bestSellers } from '@/lib/catalog/collections';
import { CompareBody } from '@/components/product/compare-body';

export const metadata: Metadata = {
  title: 'Compare products',
  description:
    'Compare iTarang inverters, batteries, UPS systems and combos side by side — capacity, technology, warranty and price.',
  robots: { index: false, follow: true },
};

export default async function ComparePage() {
  return <CompareBody suggestions={await bestSellers(8)} />;
}
