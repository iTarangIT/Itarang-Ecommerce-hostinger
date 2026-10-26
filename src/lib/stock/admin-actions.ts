'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { currentUser } from '@/lib/auth/session';
import { mailerIsLive, sendMail } from '@/lib/email/mailer';
import { backInStockMessage, type BackInStockProduct } from '@/lib/email/templates';
import { productRepository } from '@/lib/products/postgres-repository';
import type { ProductRecord } from '@/lib/products/types';
import { productPath } from '@/lib/routes';
import {
  claimNotificationSends,
  interestedCustomers,
  markRequestsNotified,
  releaseNotificationSend,
} from './notifications';
import { setStockNotificationsEnabled, stockNotificationSettingsOf } from './settings';
import { latestRestock } from './transitions';
import { logAdminEvent } from '@/lib/admin/audit';

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

  // Composed once, outside the loop: it is the same product for every
  // recipient, and building it per address would re-read nothing but would
  // invite somebody to make it depend on the recipient later.
  const details = backInStockDetails(product);

  const claimed = await claimNotificationSends(
    restock.id,
    parsed.data.emails,
    actor,
  );
  const skipped = parsed.data.emails.length - claimed.length;

  const delivered: string[] = [];
  let failed = 0;

  for (const email of claimed) {
    try {
      await sendMail(backInStockMessage(email, details));
      delivered.push(email);
    } catch (error) {
      failed += 1;
      await releaseNotificationSend(restock.id, email).catch(() => {});
      console.warn(`[stock-notify] ${email} failed`, error);
    }
  }

  /**
   * Close the requests that were actually fulfilled.
   *
   * `delivered`, not `claimed`: an address whose send failed had its claim
   * released above so it can be retried, and spending its request here would
   * take it off the list having told it nothing.
   *
   * Best-effort. A failure leaves the request open, which shows the customer in
   * the list again — where the claim in `stock_notification_sends` will refuse
   * a second mail. Failing this write can therefore waste an administrator's
   * attention but cannot produce a duplicate email, so it must not turn a
   * successful send into a reported error.
   */
  if (delivered.length > 0) {
    await markRequestsNotified(parsed.data.productKey, delivered).catch((error: unknown) => {
      console.warn('[stock-notify] could not close fulfilled requests', error);
    });
  }

  await logAdminEvent({
    entityType: 'stock',
    entityId: parsed.data.productKey,
    label: product.title,
    action: 'Sent back-in-stock emails',
    actor,
    summary: `${delivered.length} sent, ${skipped} already told, ${failed} failed`,
  });

  revalidatePath(OUT_OF_STOCK);
  revalidatePath(`/admin/products/${parsed.data.productKey}`);

  return { sent: delivered.length, skipped, failed };
}

/**
 * The product as the notification email describes it.
 *
 * Read from the catalogue at send time, so the price in the message is the
 * price on the page its button leads to.
 *
 * The variant chosen is the cheapest one that is actually in stock, falling
 * back to the cheapest priced variant. That matters because this mail exists to
 * say a product is buyable again: quoting the price of a variant that is still
 * sold out would be true of the product and false of the offer.
 */
function backInStockDetails(product: ProductRecord): BackInStockProduct {
  const priced = product.variants.filter((variant) => variant.selling !== null);
  const inStock = priced.filter((variant) => (variant.stock ?? 0) > 0);
  const cheapest = (rows: typeof priced) =>
    rows.reduce<(typeof priced)[number] | null>(
      (best, row) => (best === null || row.selling! < best.selling! ? row : best),
      null,
    );
  const variant = cheapest(inStock) ?? cheapest(priced);

  const image = product.media.find((item) => item.isPrimary) ?? product.media[0];

  return {
    title: product.title,
    path: productPath(product.slug),
    price: variant?.selling ?? null,
    mrp: variant?.mrp ?? null,
    // One sentence, not the whole description. This is a notification with a
    // reminder of what the product is, not a product page in an inbox.
    description: product.description[0] ?? product.subtitle ?? '',
    imageUrl: image?.url ?? null,
    imageAlt: image?.altText || product.title,
  };
}

/** Everyone still waiting, and how many have already been told. */
export async function interestedCustomersAction(productKey: string) {
  await requireAdminActor();
  const restock = await latestRestock(productKey);
  const { waiting, alreadyNotified } = await interestedCustomers(productKey, restock?.id ?? null);
  return { restockId: restock?.id ?? null, customers: waiting, alreadyNotified };
}

/** The console's master switch for stock notification mail. */
export async function setStockNotificationsAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  // A checkbox is absent from the form data when unticked, which is exactly the
  // shape needed: present means on.
  const enabled = formData.get('enabled') === 'on';
  await setStockNotificationsEnabled(enabled, actor);
  await logAdminEvent({
    entityType: 'stock',
    action: enabled ? 'Turned stock emails on' : 'Turned stock emails off',
    actor,
  });
  revalidatePath(OUT_OF_STOCK);
  redirect(`${OUT_OF_STOCK}?saved=1`);
}
