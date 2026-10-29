'use server';

import { currentUser } from '@/lib/auth/session';
import { sendMail } from '@/lib/email/mailer';
import { supportRequestAlertMessage, supportRequestReceivedMessage } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import {
  KIND_LABEL,
  SUPPORT_FORMS,
  pickFormValues,
  validateForm,
  type FormErrors,
  type SupportRequestKind,
} from './request-forms';
import { createSupportRequest } from './requests';

/**
 * Submit a complaint, warranty registration or installation booking.
 *
 * Validated against the same field list the page rendered (`request-forms.ts`),
 * stored, and mailed: a confirmation with the reference to the customer when
 * they gave an email, and the full request to the service inbox. The request is
 * saved before anything is mailed, and a mail failure does not undo it — the
 * customer has a reference either way, and the request is in the admin queue.
 *
 * A guest may submit; most people with a faulty battery are not signed in.
 * Identity is attached from the session when there is one, never from the form.
 */

export type SupportSubmitResult =
  | { ok: true; reference: string }
  | { ok: false; message: string; fieldErrors?: FormErrors };

const KINDS = new Set<SupportRequestKind>(['complaint', 'warranty', 'installation', 'enquiry', 'callback']);

export async function submitSupportRequestAction(
  kind: SupportRequestKind,
  input: Record<string, unknown>,
): Promise<SupportSubmitResult> {
  if (!KINDS.has(kind)) return { ok: false, message: 'Unknown request type.' };

  const fields = SUPPORT_FORMS[kind];
  const values = pickFormValues(fields, input ?? {});
  const fieldErrors = validateForm(fields, values);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: 'Please check the highlighted fields.', fieldErrors };
  }

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

  const user = await currentUser();

  let reference: string;
  try {
    const created = await createSupportRequest({ kind, values, userId: user?.id ?? null });
    reference = created.reference;
  } catch (error) {
    console.error('[support] could not save request', error);
    return {
      ok: false,
      message: 'We could not save your request just now. Please try again, or call us.',
    };
  }

  const label = KIND_LABEL[kind];
  const mails = [
    sendMail(
      supportRequestAlertMessage(env().SUPPORT_INBOX_EMAIL, {
        reference,
        kindLabel: label,
        fields: fields
          .filter((field) => values[field.name])
          .map((field) => [field.label, values[field.name]] as [string, string]),
      }),
    ),
  ];
  if (values.email) {
    mails.push(
      sendMail(
        supportRequestReceivedMessage(values.email, { name: values.name, reference, kindLabel: label }),
      ),
    );
  }

  const results = await Promise.allSettled(mails);
  for (const result of results) {
    if (result.status === 'rejected') console.error('[support] mail failed', result.reason);
  }

  return { ok: true, reference };
}
