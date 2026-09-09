import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { productRepository } from '@/lib/products/postgres-repository';
import { buildPricingTemplate } from '@/lib/admin/pricing-workbook';

/**
 * The downloadable working copy of the price list.
 *
 * Generated per request rather than served as a static asset, because it is
 * pre-filled with the catalogue's live SKUs *and their current prices*. That is
 * what makes it a round trip: whatever the last upload changed is what the next
 * download shows. It is also why it is gated — neither the SKU list nor the
 * price list is public.
 *
 * `currentUser()` rather than `requireAdmin()`, per the note in
 * `lib/auth/guards.ts` — those helpers redirect, which is the wrong answer from
 * a route handler. A signed-out visitor is sent to sign in because this URL is
 * reached by clicking a link; anyone signed in without the role gets a 404
 * rather than a 403, so the endpoint's existence is not confirmed.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return Response.redirect(
      new URL('/login?next=%2Fadmin%2Fproducts%2Fbulk-pricing', env().NEXT_PUBLIC_SITE_URL),
      302,
    );
  }
  if (user.role !== 'admin') return new Response('Not found', { status: 404 });

  const variants = await productRepository().listVariantPrices();
  const workbook = await buildPricingTemplate(variants);

  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(workbook), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="itarang-price-list-${stamp}.xlsx"`,
      // A template carrying live SKUs must not sit in a shared cache.
      'Cache-Control': 'no-store',
    },
  });
}
