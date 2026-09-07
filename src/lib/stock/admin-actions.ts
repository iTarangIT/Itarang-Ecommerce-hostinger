'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { mailerIsLive, sendMail } from '@/lib/email/mailer';
import { backInStockMessage } from '@/lib/email/templates';
import { productRepository } from '@/lib/products/postgres-repository';
import { productPath } from '@/lib/routes';
import {
  claimNotificationSends,
  interestedCustomers,
  releaseNotificationSend,
} from './notifications';
import { setStockNotificationsEnabled, stockNotificationSettingsOf } from './settings';
import { latestRestock } from './transitions';

/**
 * Admin actions for stock notifications.
 *
 * **Sending is always a deliberate act.** Nothing in this codebase mails a
 * customer about stock automatically: a restock records a transition, the
 * console shows who is interested, and an administrator presses send. That is
 * the business's own requirement and it is also the safe default — an automatic
 * send is one bad import away from mailing every customer at once.
 *
 * Every action re-checks authorization, because a Server Action is its own POST
 * endpoint and `admin/layout.tsx` does not protect it.
 */

const OUT_OF_STOCK = '/admin/products/out-of-stock';

async function requireAdminActor(): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect(`/login?next=${encodeURIComponent(OUT_OF_STOCK)}`);
  return user.email;
}

export interface SendResult {
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
}

const sendSchema = z.object({
  productKey: z.string().trim().min(1).max(200),
  emails: z.array(z.string().trim().toLowerCase().email()).min(1).max(500),
});

/**
 * Send "it is back in stock" to chosen customers.
 *
 * Guarded three ways, in this order:
 *
 *   The **setting** — an administrator can switch stock notification mail off
 *   entirely, and that switch is checked here rather than only in the UI.
 *
 *   The **restock event** — mail is tied to a `back-in-stock` transition. With
 *   no transition there is nothing to notify about, and nothing to key the
 *   duplicate guard on. A product that has never come back cannot be announced.
 *
 *   The **claim** — `claimNotificationSends` inserts `(transition, email)` rows
 *   and returns only the ones that took. A double-clicked button, a retried
 *   action or two administrators at once therefore cannot produce two emails
 *   for the same person and the same restock: the primary key refuses.
 *
 * A failed send releases its claim, so the address can be retried rather than
 * being permanently marked as notified.
 */
export async function sendBackInStockAction(
  productKey: string,
  emails: string[],
): Promise<SendResult> {
  const actor = await requireAdminActor();

  const parsed = sendSchema.safeParse({ productKey, emails });
  if (!parsed.success) {
    return { sent: 0, skipped: 0, failed: 0, error: 'Nothing valid to send.' };
  }

  const settings = await stockNotificationSettingsOf();
  if (!settings.enabled) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      error: 'Stock notification emails are switched off. Turn them on to send.',
    };
  }

  // `sendMail` logs and resolves on failure rather than throwing, so its
  // resolution proves nothing on its own — the same reason `EmailOtpTransport`
  // checks this. Without it, every address would be claimed and marked sent
  // against a mailer that is not configured.
  if (!mailerIsLive()) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      error: 'SMTP is not configured, so no mail can be delivered. Nothing was sent.',
    };
  }

  const restock = await latestRestock(parsed.data.productKey);
  if (!restock) {
    return {
      sent: 0,
      skipped: 0,
      failed: 0,
      error:
        'This product has no recorded restock. Put stock back on the pricing tab first — the notification is tied to that event so nobody can be told twice.',
    };
  }

  const product = await productRepository().findByKey(parsed.data.productKey);
  if (!product) {
    return { sent: 0, skipped: 0, failed: 0, error: 'That product no longer exists.' };
  }

  const claimed = await claimNotificationSends(
    restock.id,
    parsed.data.emails,
    actor,
  );
  const skipped = parsed.data.emails.length - claimed.length;

  let sent = 0;
  let failed = 0;

  for (const email of claimed) {
    try {
      await sendMail(backInStockMessage(email, product.title, productPath(product.slug)));
      sent += 1;
    } catch (error) {
      failed += 1;
      await releaseNotificationSend(restock.id, email).catch(() => {});
      console.warn(`[stock-notify] ${email} failed`, error);
    }
  }

  revalidatePath(OUT_OF_STOCK);
  revalidatePath(`/admin/products/${parsed.data.productKey}`);

  return { sent, skipped, failed };
}

/** Everyone with a recorded interest, and whether they have been told. */
export async function interestedCustomersAction(productKey: string) {
  await requireAdminActor();
  const restock = await latestRestock(productKey);
  return {
    restockId: restock?.id ?? null,
    customers: await interestedCustomers(productKey, restock?.id ?? null),
  };
}

/** The console's master switch for stock notification mail. */
export async function setStockNotificationsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  // A checkbox is absent from the form data when unticked, which is exactly the
  // shape needed: present means on.
  await setStockNotificationsEnabled(formData.get('enabled') === 'on', actor);
  revalidatePath(OUT_OF_STOCK);
  redirect(`${OUT_OF_STOCK}?saved=1`);
}
