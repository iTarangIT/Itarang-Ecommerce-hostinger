import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { geography, isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  customerProfiles,
  customersCsv,
  parseCustomerFilters,
  statesCsv,
  type CustomerProfile,
} from '@/lib/admin/customers';
import { EXPORT_ROW_LIMIT, istDay } from '@/lib/orders/admin-tracking';

/**
 * The customers screen as CSV — `?table=customers` (the default) or
 * `?table=states`, with the same query string as the page, so the download is
 * exactly the filtered, sorted list on screen, every page of it.
 *
 * A route handler is not covered by the /admin layout's guard, so it checks
 * the role itself, the same way /admin/orders/export does: signed out is sent
 * to sign in, signed in without the role gets a 404.
 */
export const dynamic = 'force-dynamic';

/** `customerProfiles()` caps a page at 200 rows. */
const BATCH = 200;

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return Response.redirect(
      new URL('/login?next=%2Fadmin%2Fcustomers', env().NEXT_PUBLIC_SITE_URL),
      302,
    );
  }
  if (user.role !== 'admin') return new Response('Not found', { status: 404 });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const range = await resolveRange(
    isRangeKey(params.range) ? params.range : 'this_month',
    params.month,
    { from: params.from, to: params.to, prev: params.prev },
  );

  let body: string;
  let name: string;
  let total: number;

  if (params.table === 'states') {
    const rows = await geography(range.from, range.to);
    body = statesCsv(rows);
    name = 'customer-states';
    total = rows.length;
  } else {
    const filters = parseCustomerFilters(params);
    const rows: CustomerProfile[] = [];
    total = 0;
    for (let offset = 0; offset < EXPORT_ROW_LIMIT; offset += BATCH) {
      const page = await customerProfiles(range.from, range.to, filters, BATCH, offset);
      total = page.total;
      rows.push(...page.rows);
      if (page.rows.length < BATCH || rows.length >= total) break;
    }
    body = customersCsv(rows.slice(0, EXPORT_ROW_LIMIT));
    name = 'customers';
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="itarang-${name}-${istDay(new Date())}.csv"`,
      // Names, emails and phone numbers: never in a shared cache.
      'Cache-Control': 'no-store',
      'X-Total-Rows': String(total),
    },
  });
}
