import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { orders } from '@/lib/orders/postgres-repository';
import {
  EXPORT_ROW_LIMIT,
  istDay,
  ordersCsv,
  parseTrackingQuery,
  toListFilters,
} from '@/lib/orders/admin-tracking';
import type { Order } from '@/lib/orders/types';

/**
 * The admin order table as a CSV — the same query string as /track, so the
 * download is exactly the filtered, sorted view on screen, every page of it.
 *
 * A route handler is not covered by the /admin layout's guard, so it checks
 * the role itself. As with the price-list template: signed out is sent to sign
 * in, signed in without the role gets a 404 so the endpoint is not confirmed.
 */
export const dynamic = 'force-dynamic';

/** The repository caps a page at 200 rows. */
const BATCH = 200;

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return Response.redirect(new URL('/login?next=%2Ftrack', env().NEXT_PUBLIC_SITE_URL), 302);
  }
  if (user.role !== 'admin') return new Response('Not found', { status: 404 });

  const { query } = parseTrackingQuery(Object.fromEntries(new URL(request.url).searchParams));
  const filters = toListFilters(query);
  const repository = orders();

  const rows: Order[] = [];
  let total = 0;
  for (let offset = 0; offset < EXPORT_ROW_LIMIT; offset += BATCH) {
    const page = await repository.listOrders({ ...filters, limit: BATCH, offset });
    total = page.total;
    rows.push(...page.orders);
    if (page.orders.length < BATCH || rows.length >= total) break;
  }

  return new Response(ordersCsv(rows.slice(0, EXPORT_ROW_LIMIT)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="itarang-orders-${istDay(new Date())}.csv"`,
      // Customer names, phones and addresses: never in a shared cache.
      'Cache-Control': 'no-store',
      'X-Total-Rows': String(total),
    },
  });
}
