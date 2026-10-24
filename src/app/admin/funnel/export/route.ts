import { currentUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { isRangeKey, resolveRange } from '@/lib/admin/analytics';
import {
  customerActivity,
  funnelCounts,
  funnelVisitorCounts,
  isFunnelSegment,
  isFunnelStage,
  parseCustomerActivityFilters,
  productFunnel,
  type CustomerActivityRow,
} from '@/lib/admin/funnel';
import {
  DETAIL_EXPORT_LIMIT,
  anonymousCohort,
  cohortCsv,
  customerActivityCsv,
  isCohortMetric,
  isFunnelUnit,
  parseCohortFilters,
  parseStageDetailFilters,
  productFunnelCsv,
  stageDetail,
  stageDetailCsv,
  stagesCsv,
} from '@/lib/admin/funnel-detail';
import { allProducts } from '@/lib/catalog/collections';
import { istDay } from '@/lib/orders/admin-tracking';

/**
 * Every funnel table as CSV, with the same query string as the screen it came
 * from, so the download is exactly the filtered list on screen — every page.
 *
 *   ?table=stages      the stage table
 *   ?table=stage       the rows behind one stage (`stage`, `unit`, `segment`, filters)
 *   ?table=anonymous   the anonymous cohort (`metric`, filters) — also the visitors list
 *   ?table=customers   the customer table (filters)
 *   ?table=products    the product funnel
 *
 * A route handler is not covered by the /admin layout's guard, so it checks
 * the role itself, the same way /admin/customers/export does.
 */
export const dynamic = 'force-dynamic';

/** `customerActivity()` caps a page at 200 rows. */
const BATCH = 200;

export async function GET(request: Request): Promise<Response> {
  const user = await currentUser();
  if (!user) {
    return Response.redirect(
      new URL('/login?next=%2Fadmin%2Ffunnel', env().NEXT_PUBLIC_SITE_URL),
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
  const segment = isFunnelSegment(params.segment) ? params.segment : 'all';
  const titles = async () =>
    new Map((await allProducts().catch(() => [])).map((product) => [product.id, product.title]));

  let body: string;
  let name: string;
  let total: number;

  switch (params.table) {
    case 'stages': {
      const [counts, visitors] = await Promise.all([
        funnelCounts(range.from, range.to, segment),
        funnelVisitorCounts(range.from, range.to, segment),
      ]);
      body = stagesCsv(counts, visitors);
      name = 'funnel-stages';
      total = 10;
      break;
    }
    case 'stage': {
      if (!isFunnelStage(params.stage)) return new Response('Unknown stage', { status: 400 });
      const unit = isFunnelUnit(params.unit) ? params.unit : 'session';
      const page = await stageDetail(
        params.stage,
        unit,
        segment,
        range.from,
        range.to,
        parseStageDetailFilters(params),
        DETAIL_EXPORT_LIMIT,
      );
      body = stageDetailCsv(page.rows, unit, await titles());
      name = `funnel-${params.stage.replace(/_/g, '-')}-${unit}s`;
      total = page.total;
      break;
    }
    case 'anonymous': {
      const metric = isCohortMetric(params.metric) ? params.metric : 'visitors';
      const page = await anonymousCohort(
        range.from,
        range.to,
        metric,
        parseCohortFilters(params),
        DETAIL_EXPORT_LIMIT,
      );
      body = cohortCsv(page.rows);
      name = `funnel-anonymous-${metric}`;
      total = page.total;
      break;
    }
    case 'products': {
      const rows = await productFunnel(range.from, range.to, 200);
      const map = await titles();
      const q = params.q?.trim().toLowerCase();
      const kept = q
        ? rows.filter(
            (row) =>
              row.productId.toLowerCase().includes(q) ||
              (map.get(row.productId) ?? '').toLowerCase().includes(q),
          )
        : rows;
      body = productFunnelCsv(kept, map);
      name = 'funnel-products';
      total = kept.length;
      break;
    }
    case 'customers':
    default: {
      const filters = parseCustomerActivityFilters(params);
      const rows: CustomerActivityRow[] = [];
      for (let offset = 0; offset < DETAIL_EXPORT_LIMIT; offset += BATCH) {
        const batch = await customerActivity(range.from, range.to, BATCH, filters, offset);
        rows.push(...batch);
        if (batch.length < BATCH) break;
      }
      body = customerActivityCsv(rows);
      name = 'funnel-customers';
      total = rows.length;
    }
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="itarang-${name}-${istDay(new Date())}.csv"`,
      // Names and e-mails: never in a shared cache.
      'Cache-Control': 'no-store',
      'X-Total-Rows': String(total),
    },
  });
}
