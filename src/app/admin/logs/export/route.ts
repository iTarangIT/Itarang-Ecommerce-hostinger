import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  orderLog,
  orderLogCsv,
  productLog,
  productLogCsv,
  type OrderLogRow,
  type ProductLogRow,
} from '@/lib/admin/logs';
import { EXPORT_ROW_LIMIT, istDay } from '@/lib/orders/admin-tracking';

/**
 * Logs as CSV — `?tab=product` (the default) or `?tab=order`, with the same
 * query string as the page, so the download is the filtered list on screen,
 * every page of it.
 *
 * A route handler is not covered by the /admin layout's guard, so it checks
 * the role itself, like /admin/customers/export.
 */
export const dynamic = 'force-dynamic';

const BATCH = 500;

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return Response.redirect(new URL('/login?next=%2Fadmin%2Flogs', env().NEXT_PUBLIC_SITE_URL), 302);
  }
  if (user.role !== 'admin') return new Response('Not found', { status: 404 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const range = await resolveRange(isRangeKey(params.range) ? params.range : 'this_month', params.month, {
    from: params.from,
    to: params.to,
    prev: params.prev,
  });
  const filters = { q: params.q, kind: params.kind };
  const tab = params.tab === 'order' ? 'order' : 'product';

  let total = 0;
  let body: string;
  if (tab === 'order') {
    const rows: OrderLogRow[] = [];
    for (let offset = 0; offset < EXPORT_ROW_LIMIT; offset += BATCH) {
      const page = await orderLog(range.from, range.to, filters, BATCH, offset);
      total = page.total;
      rows.push(...page.rows);
      if (page.rows.length < BATCH || rows.length >= total) break;
    }
    body = orderLogCsv(rows.slice(0, EXPORT_ROW_LIMIT));
  } else {
    const rows: ProductLogRow[] = [];
    for (let offset = 0; offset < EXPORT_ROW_LIMIT; offset += BATCH) {
      const page = await productLog(range.from, range.to, filters, BATCH, offset);
      total = page.total;
      rows.push(...page.rows);
      if (page.rows.length < BATCH || rows.length >= total) break;
    }
    body = productLogCsv(rows.slice(0, EXPORT_ROW_LIMIT));
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="itarang-${tab}-log-${istDay(new Date())}.csv"`,
      'Cache-Control': 'no-store',
      'X-Total-Rows': String(total),
    },
  });
}
