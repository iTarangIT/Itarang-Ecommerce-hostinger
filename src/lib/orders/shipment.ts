import type { Shipment } from './types';

/**
 * Courier and delivery details from the admin form, checked. Blank fields are
 * left out (and so cleared). Returns an error sentence for anything the
 * customer's page could not safely show — a tracking link must be http(s),
 * never `javascript:` or similar.
 */
export function parseShipment(
  form: Pick<FormData, 'get'>,
): { ok: true; shipment: Shipment } | { ok: false; error: string } {
  const read = (name: string, max: number) => {
    const value = String(form.get(name) ?? '').trim();
    return value ? value.slice(0, max) : undefined;
  };

  const shipment: Shipment = {
    courierName: read('courierName', 80),
    trackingNumber: read('trackingNumber', 80),
    trackingUrl: read('trackingUrl', 500),
    deliveryPerson: read('deliveryPerson', 80),
    deliveryPhone: read('deliveryPhone', 20),
  };

  if (shipment.trackingUrl) {
    let url: URL | null = null;
    try {
      url = new URL(shipment.trackingUrl);
    } catch {
      url = null;
    }
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
      return { ok: false, error: 'The tracking link must start with https:// (or http://).' };
    }
  }
  if (shipment.deliveryPhone && !/^[+\d][\d\s-]{6,19}$/.test(shipment.deliveryPhone)) {
    return { ok: false, error: 'Enter the delivery person’s phone as digits, e.g. 98765 43210.' };
  }

  return { ok: true, shipment };
}

export function hasShipmentDetails(shipment: Shipment): boolean {
  return Object.values(shipment).some(Boolean);
}
