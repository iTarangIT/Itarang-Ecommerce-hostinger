'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/email/mailer';
import { cancellationRequestAlertMessage } from '@/lib/email/templates';
import { hasOrderAccess } from './access';
import { normaliseOrderNumber } from './numbering';
import { orders } from './postgres-repository';

/**
 * The customer's "Request cancellation" button on their order page (R-12).
 *
 * It asks; it does not cancel. A paid order is cancelled by an admin, who
 * refunds it in the same step, so the customer is never shown "cancelled"
 * while their money is still with us. The access check is the order page's
 * own: the owning account, an admin, or the device that placed the order.
 */
export async function requestCancellationAction(formData: FormData): Promise<void> {
  const orderNumber = normaliseOrderNumber(String(formData.get('orderNumber') ?? ''));
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || undefined;
  const back = `/order/${encodeURIComponent(orderNumber)}`;

  if (!(await hasOrderAccess(orderNumber))) redirect(back);

  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) redirect(back);

  const requested = await repository.requestCancellation(order.id, note);

  // Only the press that recorded the request alerts the team; a second press
  // or a stale page (already shipped) changes nothing.
  if (requested) {
    for (const to of env().ORDER_ALERT_EMAILS) {
      void sendMail(
        cancellationRequestAlertMessage(to, {
          orderNumber: order.orderNumber,
          customer: order.contact.name,
          phone: order.contact.phone,
          note,
          total: order.amounts.total,
        }),
      ).catch((error: unknown) =>
        console.warn(`[orders] cancellation alert for ${order.orderNumber} failed`, error),
      );
    }
  }

  revalidatePath(back);
  redirect(`${back}?cancel=${requested ? 'requested' : 'unavailable'}`);
}
