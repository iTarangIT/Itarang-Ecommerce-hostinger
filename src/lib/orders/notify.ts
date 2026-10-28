import { env } from '@/lib/env';
import { sendMail } from '@/lib/email/mailer';
import {
  orderConfirmationMessage,
  orderPaidAlertMessage,
  type OrderMailLine,
} from '@/lib/email/templates';
import type { Order, PaymentMethod } from './types';

/**
 * Tell the customer and the team that an order has been paid (R-03).
 *
 * Called once per order, by `applyPaymentStatus`, only from the call that moved
 * the payment to `paid` — so the webhook and the browser callback arriving for
 * the same payment cannot both send it. Runs after the payment transaction has
 * committed and never throws: `sendMail` is best-effort, and a mail-server
 * outage must not touch a payment Razorpay has already taken.
 *
 * The WhatsApp half waits on the business naming the sending number (D-14).
 */
export function notifyOrderPaidInBackground(order: Order): void {
  void notifyOrderPaid(order).catch((error: unknown) => {
    console.warn(`[orders] paid-order mail for ${order.orderNumber} failed`, error);
  });
}

export async function notifyOrderPaid(order: Order): Promise<void> {
  const lines: OrderMailLine[] = order.items.map((item) => ({
    title: item.variantTitle ? `${item.title} (${item.variantTitle})` : item.title,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
  }));
  const total = order.amounts.total;
  const sends: Array<Promise<void>> = [];

  if (order.contact.email) {
    sends.push(
      sendMail(
        orderConfirmationMessage(order.contact.email, {
          name: order.contact.name,
          orderNumber: order.orderNumber,
          lines,
          total,
          path: `/order/${order.orderNumber}`,
        }),
      ),
    );
  }

  for (const to of env().ORDER_ALERT_EMAILS) {
    sends.push(
      sendMail(
        orderPaidAlertMessage(to, {
          orderNumber: order.orderNumber,
          customer: order.contact.name,
          phone: order.contact.phone,
          email: order.contact.email,
          city: order.shippingAddress.city,
          pincode: order.shippingAddress.pincode,
          paymentMethod: PAYMENT_METHOD_LABEL[order.paymentMethod],
          lines,
          total,
          isTest: order.isTest,
        }),
      ),
    );
  }

  await Promise.all(sends);
}

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  razorpay: 'Razorpay',
  'razorpay-test': 'Razorpay (test mode)',
  mock: 'Test payment',
  cod: 'Cash on delivery',
};
