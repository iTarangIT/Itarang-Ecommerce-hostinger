import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { productRepository } from '@/lib/products/postgres-repository';
import { buildPricingTemplate } from '@/lib/admin/pricing-workbook';

/**
 * The downloadable sample spreadsheet.
 *
 * Generated per request rather than served as a static asset, because it is
 * pre-filled with the catalogue's current SKUs — which is what stops the most
 * common cause of a rejected upload, a SKU typed from memory. That is also why
 * it is gated: the SKU list is not public.
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

  const skus = await productRepository().listVariantSkus();
  const workbook = await buildPricingTemplate(skus);

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
