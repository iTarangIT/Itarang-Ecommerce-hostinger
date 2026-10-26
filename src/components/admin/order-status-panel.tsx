import { updateOrderStatusAction, updateShipmentAction } from '@/lib/admin/actions';
import { nextOrderStatuses } from '@/lib/orders/state-machine';
import type { Order, OrderStatus, Shipment } from '@/lib/orders/types';
import { formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';

/**
 * The order's controls, at the top of the admin order page.
 *
 * They used to sit in the right-hand column under the items and payments, and
 * on a phone below the whole history. This puts the next step, the stage
 * dates and what each status means in one place above everything else.
 */

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: 'Waiting for payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Shown beside the control, and on /track in the customer's words. */
const MEANING: Array<{ status: OrderStatus; text: string }> = [
  { status: 'pending_payment', text: 'Placed online, payment not received yet. Moves to Confirmed by itself when the payment arrives.' },
  { status: 'confirmed', text: 'Payment received (or a cash-on-delivery order accepted). Stock is taken. Prepare the order.' },
  { status: 'packed', text: 'Packed and waiting for the courier. Optional — you can go straight to Shipped.' },
  { status: 'shipped', text: 'Handed to the courier or delivery person. Add their details so the customer can follow it.' },
  { status: 'delivered', text: 'Received by the customer. Final; reviews open for the customer.' },
  { status: 'cancelled', text: 'Stopped. Units go back into stock. Final.' },
];

const FIELD = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm';

export function ShipmentFields({ shipment }: { shipment: Shipment }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <input name="courierName" defaultValue={shipment.courierName ?? ''} placeholder="Courier, e.g. Delhivery" className={FIELD} maxLength={80} />
      <input name="trackingNumber" defaultValue={shipment.trackingNumber ?? ''} placeholder="Tracking / AWB number" className={FIELD} maxLength={80} />
      <input
        name="trackingUrl"
        type="url"
        defaultValue={shipment.trackingUrl ?? ''}
        placeholder="Tracking link (https://…)"
        className={`${FIELD} sm:col-span-2`}
        maxLength={500}
      />
      <input name="deliveryPerson" defaultValue={shipment.deliveryPerson ?? ''} placeholder="Delivery person" className={FIELD} maxLength={80} />
      <input name="deliveryPhone" type="tel" defaultValue={shipment.deliveryPhone ?? ''} placeholder="Delivery person's phone" className={FIELD} maxLength={20} />
    </div>
  );
}

export function OrderStatusPanel({ order }: { order: Order }) {
  const transitions = nextOrderStatuses(order.status);
  const canShip = transitions.includes('shipped');
  const shippedOrLater = order.status === 'shipped' || order.status === 'delivered';

  const stages: Array<{ label: string; at?: string }> = [
    { label: 'Placed', at: order.createdAt },
    { label: 'Payment received', at: order.stages.paidAt },
    { label: 'Confirmed', at: order.stages.confirmedAt },
    { label: 'Packed', at: order.stages.packedAt },
    { label: 'Shipped', at: order.stages.shippedAt },
    { label: 'Delivered', at: order.stages.deliveredAt },
    ...(order.stages.cancelledAt ? [{ label: 'Cancelled', at: order.stages.cancelledAt }] : []),
  ];

  return (
    <section className="mt-5 grid gap-5 rounded-lg border-2 border-primary/30 bg-card p-4 sm:p-5 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <h2 className="font-display text-base font-semibold">Move this order on</h2>
        {transitions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            This order is {STATUS_LABEL[order.status].toLowerCase()}, a final state.
          </p>
        ) : (
          <form action={updateOrderStatusAction} className="mt-3 space-y-3">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <div className="flex flex-wrap gap-2">
              {transitions.map((status, index) => (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input type="radio" name="status" value={status} defaultChecked={index === 0} required />
                  {STATUS_LABEL[status]}
                </label>
              ))}
            </div>
            <textarea
              name="note"
              rows={2}
              maxLength={1000}
              placeholder="Note (optional) — e.g. delivery slot, reason for cancelling"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="customerVisible" defaultChecked />
              Show this note to the customer on their order and tracking page
            </label>
            {canShip ? (
              <details className="rounded-md border border-border bg-surface p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Courier and delivery details (saved when you choose Shipped)
                </summary>
                <div className="mt-3">
                  <ShipmentFields shipment={order.shipment} />
                </div>
              </details>
            ) : null}
            <Button type="submit" variant="primary">
              Update status
            </Button>
          </form>
        )}

        {shippedOrLater ? (
          <form action={updateShipmentAction} className="mt-4 space-y-3 border-t border-border pt-4">
            <input type="hidden" name="orderNumber" value={order.orderNumber} />
            <h3 className="text-sm font-semibold">Courier and delivery details</h3>
            <ShipmentFields shipment={order.shipment} />
            <Button type="submit" variant="outline" size="sm">
              Save delivery details
            </Button>
          </form>
        ) : null}
      </div>

      <div className="space-y-4 lg:col-span-5">
        <div>
          <h3 className="text-sm font-semibold">Stage dates</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            {stages.map((stage) => (
              <div key={stage.label} className="contents">
                <dt className="text-muted-foreground">{stage.label}</dt>
                <dd className="tabular text-foreground">
                  {stage.at
                    ? formatDateTime(stage.at)
                    : stage.label === 'Packed' && (order.stages.shippedAt || order.stages.deliveredAt)
                      ? 'Skipped'
                      : '—'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">What each status means</summary>
          <dl className="mt-2 space-y-2">
            {MEANING.map((entry) => (
              <div key={entry.status}>
                <dt className="font-medium text-foreground">{STATUS_LABEL[entry.status]}</dt>
                <dd className="text-xs text-muted-foreground">{entry.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Order: Waiting for payment → Confirmed → Packed (optional) → Shipped → Delivered. Cancel
            is possible until it ships.
          </p>
        </details>
      </div>
    </section>
  );
}
