'use server';

import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { LIMITS, callerIp, consume } from '@/lib/security/rate-limit';
import {
  hasStockNotification,
  requestStockNotification,
} from './notifications';

/**
 * "Notify me when this is back", as a Server Action.
 *
 * **Nothing here sends mail.** The request is recorded and that is all; a
 * customer is told about a restock only when an administrator sends it from the
 * console. That keeps the promise on the button — one message, when it is back
 * — honest, and means no automated job can start mailing people because a
 * migration moved a stock count.
 *
 * A guest may sign up. Requiring an account before we will tell somebody a
 * battery is available would lose the sale, and the address is the only thing
 * we need. It does mean the form will accept an address the sender does not
 * own, which is why `LIMITS.stockNotify` is tight and why the mail itself says
 * plainly why it arrived.
 */

export interface NotifyMeState {
  status: 'idle' | 'subscribed' | 'already' | 'error';
  message?: string;
}

const inputSchema = z.object({
  productId: z.string().trim().min(1).max(200),
  // Empty is legitimate: a product with no variant selection still has a
  // product-level interest, and the column defaults to '' so the unique index
  // treats it as one value rather than as SQL NULL, which never collides.
  sku: z.string().trim().max(200).default(''),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Enter an email address we can reach you at.')
    .max(320),
});

const THROTTLED =
  'That is a lot of notification requests from here. Try again in a little while.';

export async function notifyWhenBackInStockAction(
  _previous: NotifyMeState,
  formData: FormData,
): Promise<NotifyMeState> {
  const parsed = inputSchema.safeParse({
    productId: formData.get('productId'),
    sku: formData.get('sku') ?? '',
    email: formData.get('email'),
  });

  if (!parsed.success) {
    return { status: 'error', message: parsed.error.issues[0]!.message };
  }

  const { productId, sku, email } = parsed.data;

  // Two buckets, as the sign-in code path does: per address so one person
  // cannot be enrolled for everything, and per IP so one machine cannot enrol
  // many addresses.
  const [byEmail, byIp] = await Promise.all([
    consume(`stock-notify:${email}`, LIMITS.stockNotify),
    consume(`stock-notify:ip:${await callerIp()}`, LIMITS.stockNotifyByIp),
  ]);
  if (!byEmail.allowed || !byIp.allowed) {
    return { status: 'error', message: THROTTLED };
  }

  // Attached to the account when there is one, so the admin list can show who
  // is asking. Identity is read from the session and never from the form.
  const user = await currentUser();

  try {
    const { alreadyRequested } = await requestStockNotification({
      productId,
      sku,
      email,
      userId: user?.id ?? null,
    });

    return {
      status: alreadyRequested ? 'already' : 'subscribed',
      message: alreadyRequested
        ? 'You are already on the list for this product.'
        : 'We will email you once, as soon as it is back.',
    };
  } catch (error) {
    console.warn('[notify-me] could not record the request', error);
    return {
      status: 'error',
      message: 'We could not save that just now. Please try again in a few minutes.',
    };
  }
}

/** Whether the signed-in customer is already waiting, to prefill the control. */
export async function stockNotificationStatusAction(
  productId: string,
  sku: string,
): Promise<{ email: string | null; subscribed: boolean }> {
  const user = await currentUser();
  if (!user) return { email: null, subscribed: false };

  return {
    email: user.email,
    subscribed: await hasStockNotification(productId, sku, user.email),
  };
}
