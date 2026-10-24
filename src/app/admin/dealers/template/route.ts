import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { buildDealerTemplate } from '@/lib/support/dealer-workbook';

/**
 * The bulk dealer upload template. Admin-only like the rest of the console;
 * `currentUser()` rather than `requireAdmin()` because a route handler should
 * answer, not redirect mid-stream — see the bulk-pricing template route.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return Response.redirect(new URL('/login?next=%2Fadmin%2Fdealers', env().NEXT_PUBLIC_SITE_URL), 302);
  }
  if (user.role !== 'admin') return new Response('Not found', { status: 404 });

  const workbook = await buildDealerTemplate();
  return new Response(new Uint8Array(workbook), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="itarang-dealers-template.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
