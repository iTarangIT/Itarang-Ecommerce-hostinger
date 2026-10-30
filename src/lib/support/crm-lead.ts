import { env } from '@/lib/env';

/**
 * Hand a finance enquiry to the CRM as a lead (R-15).
 *
 * Best effort by design. The enquiry is already saved in `support_requests`
 * and mailed to the team before this runs, so the shopper's "we will call you"
 * is true whatever happens here; this only saves somebody re-keying it into
 * the CRM. A slow or failing CRM is given a few seconds and then recorded as
 * not forwarded, never retried in the shopper's request.
 *
 * The contract is agreed with the CRM side and must not drift:
 *   POST {CRM_BASE_URL}/api/integrations/online-store/finance-lead
 *   x-store-key: {CRM_STORE_API_KEY}
 *   → 200/201 { ok: true, leadId, duplicate? }
 * `storeRef` is our reference, so a retry of the same enquiry is recognised by
 * the CRM as a duplicate rather than filed twice.
 */

export interface FinanceLead {
  storeRef: string;
  name: string;
  /** 10 digits, no +91. */
  mobile: string;
  pincode: string;
  productSku: string | null;
  productTitle: string | null;
  productUrl: string | null;
  pricePaise: number | null;
  page: 'product' | 'checkout';
}

export type ForwardResult =
  | { ok: true; leadId: string; duplicate: boolean }
  | { ok: false; error: string }
  /** CRM_BASE_URL / CRM_STORE_API_KEY unset: nothing was sent. */
  | { ok: false; skipped: true };

export const CRM_TIMEOUT_MS = 6_000;

export function crmConfigured(): boolean {
  const config = env();
  return Boolean(config.CRM_BASE_URL && config.CRM_STORE_API_KEY);
}

export async function forwardFinanceLead(lead: FinanceLead): Promise<ForwardResult> {
  const config = env();
  if (!config.CRM_BASE_URL || !config.CRM_STORE_API_KEY) return { ok: false, skipped: true };

  const url = `${config.CRM_BASE_URL.replace(/\/$/, '')}/api/integrations/online-store/finance-lead`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-store-key': config.CRM_STORE_API_KEY },
      body: JSON.stringify(lead),
      signal: AbortSignal.timeout(CRM_TIMEOUT_MS),
      cache: 'no-store',
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      ok: false,
      error: timedOut
        ? `CRM did not answer within ${CRM_TIMEOUT_MS / 1000} s`
        : `CRM unreachable: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* a non-JSON body is reported by status below */
  }

  if (response.status !== 200 && response.status !== 201) {
    const message =
      body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
        ? `: ${(body as { error: string }).error}`
        : '';
    return { ok: false, error: `CRM answered ${response.status}${message}`.slice(0, 500) };
  }

  const { ok, leadId, duplicate } = (body ?? {}) as { ok?: unknown; leadId?: unknown; duplicate?: unknown };
  if (ok !== true || typeof leadId !== 'string' || !leadId) {
    return { ok: false, error: `CRM answered ${response.status} without a lead id` };
  }
  return { ok: true, leadId, duplicate: duplicate === true };
}
