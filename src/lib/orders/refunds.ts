import type { Paise } from '@/lib/commerce/types';
import { formatPrice } from '@/lib/catalog/pricing';
import { paymentProvider } from '@/lib/payments';
import { sendMail } from '@/lib/email/mailer';
import { refundStartedMessage } from '@/lib/email/templates';
import { orders } from './postgres-repository';
import { canTransitionOrder } from './state-machine';
import { REFUND_REFUSAL_MESSAGES, refundRefusal } from './refund-rules';
import type { Order } from './types';

/**
 * Cancel and refund a paid, unshipped order (R-12).
 *
 * The order of the steps is the point:
 *
 * 1. The refund row is reserved under the order's lock, against the cap.
 * 2. The gateway is asked. If it refuses, the row is marked failed and the
 *    order is left exactly as it was — nothing is cancelled on a refund that
 *    did not happen.
 * 3. Only then is the order cancelled, which also puts the units back on the
 *    shelf (`transitionOrderStatus`).
 * 4. The payment moves to `refunded` when the money has actually gone back in
 *    full — at once for a gateway that settles synchronously, otherwise when
 *    `refund.processed` arrives at the webhook.
 *
 * Returns the sentence the admin is shown.
 */
export async function cancelAndRefund(input: {
  order: Order;
  amount: Paise;
  reason: string;
  actor: string;
}): Promise<{ ok: boolean; message: string }> {
  const { order, amount, reason, actor } = input;
  const repository = orders();
  const provider = paymentProvider();

  const refusal = refundRefusal(order, await repository.listRefunds(order.id), provider.id);
  if (refusal) return { ok: false, message: REFUND_REFUSAL_MESSAGES[refusal] };

  const captured = (await repository.listPayments(order.id))
    .filter((payment) => payment.status === 'paid' && payment.provider === provider.id)
    .at(-1);
  if (!captured) {
    return { ok: false, message: 'No captured payment is recorded on this order to refund against.' };
  }

  const reserved = await repository.beginRefund({
    orderId: order.id,
    amount,
    reason,
    requestedBy: actor,
    provider: provider.id,
    gatewayPaymentId: captured.gatewayPaymentId,
  });
  if (!reserved.ok) {
    return {
      ok: false,
      message:
        reserved.reason === 'exceeds_paid'
          ? `Refused: at most ${formatPrice(reserved.refundable)} can still be refunded on this order.`
          : REFUND_REFUSAL_MESSAGES.not_paid,
    };
  }

  let result;
  try {
    result = await provider.refund({
      gatewayPaymentId: captured.gatewayPaymentId,
      amount,
      orderNumber: order.orderNumber,
      reason,
    });
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[refund] ${order.orderNumber}: ${message}`);
    await repository.recordRefundResponse(reserved.refundId, { status: 'failed', error: message.slice(0, 500) });
    return { ok: false, message: 'The payment gateway refused the refund. Nothing was cancelled. Check the gateway dashboard and try again.' };
  }

  await repository.recordRefundResponse(reserved.refundId, {
    gatewayRefundId: result.refundId,
    status: result.status,
  });

  if (result.status === 'processed') {
    const { fullyRefunded } = await repository.settleRefund({
      orderId: order.id,
      provider: provider.id,
      gatewayRefundId: result.refundId,
      status: 'processed',
    });
    if (fullyRefunded) await repository.applyPaymentStatus(order.id, 'refunded', actor, 'Refunded in full');
  }

  await repository.addOrderNote(
    order.id,
    actor,
    `Refund of ${formatPrice(amount)} started (${result.refundId}): ${reason}`,
    false,
  );

  if (order.status !== 'cancelled' && canTransitionOrder(order.status, 'cancelled')) {
    await repository.transitionOrderStatus(
      order.id,
      'cancelled',
      actor,
      `Cancelled and ${formatPrice(amount)} refunded to the original payment method.`,
    );
  }

  if (order.contact.email) {
    // Best effort, like every customer mail: the refund has happened either way.
    void sendMail(
      refundStartedMessage(order.contact.email, {
        name: order.contact.name,
        orderNumber: order.orderNumber,
        amount,
        path: `/order/${order.orderNumber}`,
      }),
    ).catch((error: unknown) => console.warn(`[refund] mail for ${order.orderNumber} failed`, error));
  }

  return {
    ok: true,
    message:
      result.status === 'processed'
        ? `${order.orderNumber} cancelled and ${formatPrice(amount)} refunded.`
        : `${order.orderNumber} cancelled. Refund of ${formatPrice(amount)} started; the payment shows Refunded once Razorpay confirms it.`,
  };
}
