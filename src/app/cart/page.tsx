import type { Metadata } from 'next';
import { bestSellers } from '@/lib/catalog/collections';
import { CartPageBody } from '@/components/cart/cart-page-body';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review your iTarang order before checkout.',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  // Recommendations are resolved on the server so the client only receives cards.
  return <CartPageBody recommendations={await bestSellers(8)} />;
}
