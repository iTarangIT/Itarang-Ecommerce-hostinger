import { env } from '@/lib/env';
import { mailerIsLive, sendMail } from '@/lib/email/mailer';
import { outOfStockAlertMessage } from '@/lib/email/templates';
import { productRepository } from '@/lib/products/postgres-repository';
import { notifyMeCountFor } from './notifications';
import { stockNotificationSettingsOf } from './settings';
import {
  claimStockAlert,
  pendingStockAlerts,
  releaseStockAlert,
  type PendingAlert,
} from './transitions';

/**
 * Sending the internal out-of-stock alert.
 *
 * **Never called inside the transaction that changed the stock.** The two write
 * paths record a transition and commit; this runs afterwards, from a point
 * where failing is survivable. On the order path that is not a style
 * preference: `recordPaymentCaptured` deducts stock inside the payment
 * transaction, and an SMTP timeout inside it would roll back a payment that
 * Razorpay has already taken.
 *
 * Everything here is therefore best-effort and never throws to its caller. A
 * failed send releases its claim so the next pass retries; an unsent alert is
 * visible in the admin out-of-stock list, which is the fallback that matters.
 */

/** Fire-and-forget dispatch, safe to call from a request path. */
export function dispatchStockAlertsInBackground(): void {
  void dispatchPendingStockAlerts().catch((error: unknown) => {
    console.warn('[stock-alerts] dispatch failed', error);
  });
}

export async function dispatchPendingStockAlerts(): Promise<{ sent: number; skipped: number }> {
  const settings = await stockNotificationSettingsOf();
  if (!settings.enabled) return { sent: 0, skipped: 0 };

  // `sendMail` swallows transport failures, so its resolution proves nothing on
  // its own — the same reason `EmailOtpTransport` checks this first. Without
  // the check, every pending alert would be marked sent against a mailer that
  // is not configured, and the backlog would be silently lost.
  if (!mailerIsLive()) return { sent: 0, skipped: 0 };

  const pending = await pendingStockAlerts();
  if (pending.length === 0) return { sent: 0, skipped: 0 };

  const recipient = env().STOCK_ALERT_EMAIL;
  let sent = 0;
  let skipped = 0;

  for (const alert of pending) {
    // Claim first: two processes reaching the same row both run the UPDATE and
    // exactly one of them wins, so the alert is sent once even under
    // concurrency.
    if (!(await claimStockAlert(alert.id))) {
      skipped += 1;
      continue;
    }

    try {
      await sendMail(await composeAlert(alert, recipient));
      sent += 1;
    } catch (error) {
      // Hand it back so the next pass retries rather than losing it.
      await releaseStockAlert(alert.id).catch(() => {});
      console.warn(`[stock-alerts] ${alert.sku} alert failed`, error);
    }
  }

  return { sent, skipped };
}

async function composeAlert(alert: PendingAlert, recipient: string) {
  const product = await productRepository().findByKey(alert.productId);

  return outOfStockAlertMessage(recipient, {
    // The product may have been archived between the transition and the send.
    // The SKU always identifies it, so the alert is still useful.
    productTitle: product?.title ?? alert.productId,
    sku: alert.sku,
    source: alert.source,
    waitingCount: await notifyMeCountFor(alert.productId),
  });
}
