'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, SlidersHorizontal } from 'lucide-react';
import { updateOrderStatusAction, updateShipmentAction } from '@/lib/admin/actions';
import { nextOrderStatuses } from '@/lib/orders/state-machine';
import type { OrderStatus, Shipment } from '@/lib/orders/types';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/field';
import { STATUS_LABEL, ShipmentFields } from './order-status-panel';

/**
 * The Action button on each row of the orders list: move the order on
 * (Packed, Shipped, Delivered, Cancel — whichever the state machine allows),
 * add a note, and enter courier details, without opening the order.
 *
 * Posts to the same Server Actions as the order page, with `returnTo=list` so
 * the admin lands back on the list, filters and page kept.
 */
export function OrderQuickActions({
  orderNumber,
  customer,
  status,
  shipment,
  listQuery,
}: {
  orderNumber: string;
  customer: string;
  status: OrderStatus;
  shipment: Shipment;
  /** The list's current query string, so the form returns to the same view. */
  listQuery: string;
}) {
  const [open, setOpen] = useState(false);
  const transitions = nextOrderStatuses(status);
  const [chosen, setChosen] = useState<OrderStatus | undefined>(transitions[0]);
  const shippedOrLater = status === 'shipped' || status === 'delivered';

  if (transitions.length === 0 && !shippedOrLater) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const hidden = (
    <>
      <input type="hidden" name="orderNumber" value={orderNumber} />
      <input type="hidden" name="returnTo" value="list" />
      <input type="hidden" name="listQuery" value={listQuery} />
    </>
  );

  return (
    <>
      <Button
        type="button"
        variant={transitions.length > 0 ? 'primary' : 'outline'}
        size="sm"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Action
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} label={`Update order ${orderNumber}`} className="max-w-xl overflow-y-auto">
        <div className="space-y-5 p-5 pr-14">
          <div>
            <h2 className="font-display text-lg font-bold">{orderNumber}</h2>
            <p className="text-sm text-muted-foreground">
              {customer} · now <strong className="text-foreground">{STATUS_LABEL[status]}</strong>
            </p>
          </div>

          {transitions.length > 0 ? (
            <form action={updateOrderStatusAction} className="space-y-3">
              {hidden}
              <fieldset>
                <legend className="text-sm font-semibold">Move to</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {transitions.map((next) => (
                    <label
                      key={next}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name="status"
                        value={next}
                        checked={chosen === next}
                        onChange={() => setChosen(next)}
                        required
                      />
                      {STATUS_LABEL[next]}
                    </label>
                  ))}
                </div>
              </fieldset>

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

              {chosen === 'shipped' ? (
                <div className="space-y-2 rounded-md border border-border bg-surface p-3">
                  <p className="text-sm font-medium">Courier and delivery details</p>
                  <ShipmentFields shipment={shipment} />
                </div>
              ) : null}

              <Button type="submit" variant="primary">
                Update status
              </Button>
            </form>
          ) : null}

          {shippedOrLater ? (
            <form action={updateShipmentAction} className="space-y-3 border-t border-border pt-4">
              {hidden}
              <h3 className="text-sm font-semibold">Courier and delivery details</h3>
              <ShipmentFields shipment={shipment} />
              <Button type="submit" variant="outline" size="sm">
                Save delivery details
              </Button>
            </form>
          ) : null}

          <Link
            href={`/admin/orders/${orderNumber}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Open the full order
          </Link>
        </div>
      </Modal>
    </>
  );
}
