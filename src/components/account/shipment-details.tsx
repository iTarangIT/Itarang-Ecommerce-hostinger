import { ExternalLink, Phone, Truck } from 'lucide-react';
import type { Shipment } from '@/lib/orders/types';

/**
 * Courier and delivery details, as the admin entered them at dispatch. Shown
 * on the customer's order page and on /track; renders nothing until there is
 * something to show.
 */
export function ShipmentDetails({ shipment }: { shipment: Shipment | undefined }) {
  if (!shipment) return null;
  const { courierName, trackingNumber, trackingUrl, deliveryPerson, deliveryPhone } = shipment;
  if (!courierName && !trackingNumber && !trackingUrl && !deliveryPerson && !deliveryPhone) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Truck className="h-4 w-4 text-accent-600" />
        Delivery details
      </p>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        {courierName ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Courier</dt>
            <dd className="mt-0.5 font-medium text-foreground">{courierName}</dd>
          </div>
        ) : null}
        {trackingNumber || trackingUrl ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Tracking</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {trackingNumber ? <span className="tabular">{trackingNumber}</span> : null}
              {trackingUrl ? (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  Track with courier
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </dd>
          </div>
        ) : null}
        {deliveryPerson || deliveryPhone ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">Delivery person</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {deliveryPerson}
              {deliveryPhone ? (
                <a
                  href={`tel:${deliveryPhone.replace(/[^\d+]/g, '')}`}
                  className="ml-2 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="tabular">{deliveryPhone}</span>
                </a>
              ) : null}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
