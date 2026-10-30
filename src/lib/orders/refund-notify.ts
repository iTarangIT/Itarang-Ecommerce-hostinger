import { env } from '@/lib/env';
import { sendMail } from '@/lib/email/mailer';
import { refundCustomerMessage, refundTeamMessage } from '@/lib/email/templates';
import { orders } from './postgres-repository';
import { customerRefunds } from './refund-rules';
import type { Order } from './types';

/**
 * Tell everybody about one refund (R-12): the customer, with the dates the
 * money should arrive between, and the team — ORDER_ALERT_EMAILS,
 * REFUND_ALERT_EMAILS and the admin who made it.
 *
 * Called when a refund starts and again when the gateway confirms one that
 * was still processing, so a customer whose refund settles later hears that
 * it has. A failed refund goes to the team only.
 *
 * Best effort, like every mail here: the refund has happened (or failed)
 * whether or not the mail goes out, so nothing is thrown.
 */
export async function notifyRefund(order: Order, gatewayRefundId: string): Promise<void> {
  try {
    const refunds = await orders().listRefunds(order.id);
    const refund = refunds.find((candidate) => candidate.gatewayRefundId === gatewayRefundId);
    if (!refund) return;

    const timeline = customerRefunds([refund])[0];
    const details = {
      orderNumber: order.orderNumber,
      amount: refund.amount,
      refundedSoFar: refunds
        .filter((candidate) => candidate.status !== 'failed')
        .reduce((sum, candidate) => sum + candidate.amount, 0),
      orderTotal: order.amounts.total,
      state: refund.status,
      reference: refund.gatewayRefundId,
      creditFrom: timeline?.creditFrom,
      creditBy: timeline?.creditBy,
    };

    const mails = [];
    if (order.contact.email && refund.status !== 'failed') {
      mails.push(
        refundCustomerMessage(order.contact.email, {
          ...details,
          name: order.contact.name,
          path: `/order/${order.orderNumber}`,
        }),
      );
    }

    const team = new Set([...env().ORDER_ALERT_EMAILS, ...env().REFUND_ALERT_EMAILS]);
    // The admin who pressed the button; "gateway dashboard" and the like are not addresses.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refund.requestedBy)) team.add(refund.requestedBy);
    for (const to of team) {
      mails.push(
        refundTeamMessage(to, {
          ...details,
          customer: order.contact.name,
          phone: order.contact.phone,
          email: order.contact.email,
          reason: refund.reason,
          by: refund.requestedBy,
          error: refund.error,
        }),
      );
    }

    await Promise.all(
      mails.map((mail) =>
        sendMail(mail).catch((error: unknown) =>
          console.warn(`[refund] mail to ${mail.to} for ${order.orderNumber} failed`, error),
        ),
      ),
    );
  } catch (error) {
    console.warn(`[refund] notifications for ${order.orderNumber} failed`, error);
  }
}
