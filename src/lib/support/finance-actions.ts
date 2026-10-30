'use server';

import { after } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import { allProducts } from '@/lib/catalog/collections';
import { sendMail } from '@/lib/email/mailer';
import { supportRequestAlertMessage } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import { forwardFinanceLead } from './crm-lead';
import {
  describeFinanceItems,
  financeLeadFrom,
  subjectDetails,
  type FinanceItemInput,
  type FinancePage,
} from './finance-enquiry';
import { KIND_LABEL, SUPPORT_FORMS, pickFormValues, validateForm } from './request-forms';
import type { SupportSubmitResult } from './request-actions';
import { createSupportRequest, recordCrmForward } from './requests';

/**
 * "Buy on finance" (R-15), from the product page and from checkout.
 *
 * The same pipeline as the expert call-back popup — the shared field list and
 * validator, the same per-number and per-IP limits, a `support_requests` row
 * and the alert to the service inbox — with one addition: the enquiry is then
 * handed to the CRM as a lead.
 *
 * Order matters. The row is written first and is the copy of record; the
 * shopper is told "we will call you" once it exists, whatever the CRM does.
 * The CRM call runs after the response has been sent (`after`), so a slow CRM
 * never keeps the shopper waiting, and its outcome — lead id, or why not — is
 * written back onto the row for Admin → Support to show and retry.
 */
export async function submitFinanceEnquiryAction(input: {
  values: Record<string, unknown>;
  page: FinancePage;
  items: FinanceItemInput[];
}): Promise<SupportSubmitResult> {
  const fields = SUPPORT_FORMS.finance;
  const values = pickFormValues(fields, input?.values ?? {});
  const fieldErrors = validateForm(fields, values);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors };
  }
  const page: FinancePage = input.page === 'checkout' ? 'checkout' : 'product';

  const [byPhone, byIp] = await Promise.all([
    consume(`support:${values.phone}`, LIMITS.supportRequest),
    consume(`support:ip:${await callerIp()}`, LIMITS.supportRequestByIp),
  ]);
  if (!byPhone.allowed || !byIp.allowed) {
    return {
      ok: false,
      message: 'We have already received several requests from this number. Please call us instead.',
    };
  }

  const config = env();
  let subject = describeFinanceItems([], [], config.NEXT_PUBLIC_SITE_URL);
  try {
    const items = Array.isArray(input.items) ? input.items : [];
    subject = describeFinanceItems(items, await allProducts(), config.NEXT_PUBLIC_SITE_URL);
  } catch (error) {
    // The product is context, not the request: a catalogue hiccup must not
    // cost the shopper their call-back.
    console.error('[finance] could not resolve the product', error);
  }

  const user = await currentUser();
  let request;
  try {
    request = await createSupportRequest({
      kind: 'finance',
      values: { ...values, ...subjectDetails(subject, page) },
      userId: user?.id ?? null,
    });
  } catch (error) {
    console.error('[finance] could not save enquiry', error);
    return {
      ok: false,
      message: 'We could not save your request just now. Please try again, or call us.',
    };
  }

  const fieldsForMail: Array<[string, string]> = [
    ['Name', request.name],
    ['Mobile', request.phone],
    ['Pincode', request.pincode ?? ''],
    ['From', page === 'checkout' ? 'Checkout' : 'Product page'],
    ...(subject.productTitle ? [['Product', subject.productTitle] as [string, string]] : []),
    ...(subject.productSku ? [['SKU', subject.productSku] as [string, string]] : []),
    ...(subject.pricePaise !== null
      ? [['Price', `₹${(subject.pricePaise / 100).toLocaleString('en-IN')}`] as [string, string]]
      : []),
    ...(subject.productUrl ? [['Page', subject.productUrl] as [string, string]] : []),
  ];
  try {
    await sendMail(
      supportRequestAlertMessage(config.SUPPORT_INBOX_EMAIL, {
        reference: request.reference,
        kindLabel: KIND_LABEL.finance,
        fields: fieldsForMail,
      }),
    );
  } catch (error) {
    console.error('[finance] alert mail failed', error);
  }

  const lead = financeLeadFrom(request);
  const id = request.id;
  after(async () => {
    try {
      const outcome = await forwardFinanceLead(lead);
      if ('skipped' in outcome) return;
      if (!outcome.ok) console.error(`[finance] ${lead.storeRef} not forwarded: ${outcome.error}`);
      await recordCrmForward(id, outcome);
    } catch (error) {
      console.error(`[finance] ${lead.storeRef} forward could not be recorded`, error);
    }
  });

  return { ok: true, reference: request.reference };
}
