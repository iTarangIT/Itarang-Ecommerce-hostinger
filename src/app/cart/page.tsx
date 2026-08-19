import type { Metadata } from 'next';
import { bestSellers } from '@/lib/catalog/collections';
import { currentUser } from '@/lib/auth/session';
import { CartPageBody } from '@/components/cart/cart-page-body';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your cart',
  description: 'Review your iTarang order before checkout.',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  // Recommendations are resolved on the server so the client only receives cards.
  // The sign-in state travels with them so the cart can say up front that
  // checkout needs an account, rather than bouncing the shopper after they have
  // already started filling in an address.
  const [recommendations, user] = await Promise.all([bestSellers(8), currentUser()]);
  return <CartPageBody recommendations={recommendations} signedIn={Boolean(user)} />;
}
