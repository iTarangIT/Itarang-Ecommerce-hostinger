'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
import { allProducts } from '@/lib/catalog/collections';
import { invalidateCatalogueSnapshot } from '@/lib/commerce/health';
import { resolveCatalogueAlert, syncCatalogue } from '@/lib/commerce/catalogue-sync';
import { drainInventoryQueue } from '@/lib/orders/inventory-push';
import { canTransitionOrder } from '@/lib/orders/state-machine';
import { hasShipmentDetails, parseShipment } from '@/lib/orders/shipment';
import type { OrderStatus } from '@/lib/orders/types';
import { sendMail } from '@/lib/email/mailer';
import { stockDelayMessage } from '@/lib/email/templates';

/**
 * Admin order actions.
 *
 * Sign-in and sign-out are no longer here: admins authenticate through the same
 * `/login` as everyone else and are distinguished by `users.role`. There is one
 * credential system, not two.
 *
 * The authorization check is repeated here even though `admin/layout.tsx`
 * already guards every page. A Server Action is its own endpoint — it is reached
 * by a POST to the action id, not by rendering a page — so the layout's check
 * does not protect it. Removing this line would leave the mutation open.
 */

async function requireAdminActor(): Promise<string> {
  const user = await currentUser();
  if (!user || user.role !== 'admin') redirect('/login?next=%2Fadmin');
  return user.email;
}

/**
 * Move an order to its next fulfilment state.
 *
 * The transition is validated against the state machine, so the console cannot
 * put an order into an impossible state even if the form is tampered with.
 */
export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const orderNumber = String(formData.get('orderNumber') ?? '');
  const to = String(formData.get('status') ?? '') as OrderStatus;
  const note = String(formData.get('note') ?? '').trim().slice(0, 1000) || undefined;
  // Unticked "Show to customer" keeps the note on the admin page only.
  const customerVisible = formData.get('customerVisible') === 'on';
  const back = `/admin/orders/${orderNumber}`;

  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) return;

  // Said, not silently ignored: a stale tab can offer a move that is no
  // longer possible (the payment arrived, another admin shipped it).
  if (!canTransitionOrder(order.status, to)) {
    redirect(`${back}?notice=${encodeURIComponent(`This order is ${order.status.replace(/_/g, ' ')} and cannot move to ${to.replace(/_/g, ' ')}. The page has been refreshed.`)}`);
  }

  // Courier details are saved with the move to Shipped, in one transaction.
  let shipment;
  if (to === 'shipped') {
    const parsed = parseShipment(formData);
    if (!parsed.ok) redirect(`${back}?notice=${encodeURIComponent(parsed.error)}`);
    if (hasShipmentDetails(parsed.shipment)) shipment = parsed.shipment;
  }

  // The actor is the admin's email rather than the literal string 'admin', so
  // the order history answers *who* changed it, not just that somebody did.
  await repository.transitionOrderStatus(order.id, to, actor, note, { customerVisible, shipment });

  revalidatePath('/admin');
  revalidatePath(back);
  redirect(`${back}?notice=${encodeURIComponent(`Order moved to ${to.replace(/_/g, ' ')}.`)}`);
}

/** Courier and delivery details for a shipped order, entered or corrected later. */
export async function updateShipmentAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orderNumber = String(formData.get('orderNumber') ?? '');
  const back = `/admin/orders/${orderNumber}`;

  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) return;

  const parsed = parseShipment(formData);
  if (!parsed.ok) redirect(`${back}?notice=${encodeURIComponent(parsed.error)}`);

  await repository.updateShipment(order.id, parsed.shipment, actor);
  revalidatePath(back);
  redirect(`${back}?notice=${encodeURIComponent('Delivery details saved.')}`);
}

/**
 * Tell the customer their order is delayed because it is out of stock.
 *
 * The business asked for this apology whenever an order cannot be fulfilled
 * from stock. It changes nothing about the order — the status stays where it
 * is — and is recorded in the order history so nobody sends it twice without
 * seeing that it was sent. Only for confirmed, not-yet-shipped orders: before
 * payment there is nothing to fulfil, and after dispatch there is no delay.
 */
export async function notifyStockDelayAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const orderNumber = String(formData.get('orderNumber') ?? '');
  const back = `/admin/orders/${orderNumber}`;

  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) return;

  if (order.status !== 'confirmed' && order.status !== 'packed') {
    redirect(`${back}?notice=${encodeURIComponent('Only a confirmed order that has not shipped can be delayed.')}`);
  }
  if (!order.contact.email) {
    redirect(`${back}?notice=${encodeURIComponent('This order has no email address. Call the customer instead.')}`);
  }

  await sendMail(
    stockDelayMessage(order.contact.email, {
      name: order.contact.name,
      orderNumber: order.orderNumber,
      items: order.items.map((item) => item.title),
      path: `/order/${order.orderNumber}`,
    }),
  );
  await repository.addOrderNote(order.id, actor, 'Customer emailed: order delayed, out of stock.');

  revalidatePath(back);
  redirect(`${back}?notice=${encodeURIComponent('Delay email sent to the customer.')}`);
}

/**
 * Re-mirror Hostinger's stock, and refresh the catalogue mirror.
 *
 * This began as the manual half of the inventory loop, for a time when nothing
 * could write to Hostinger at all: the admin deducted sold units by hand in
 * hPanel and pressed this to re-read them. Automatic pushing now handles that
 * (`orders/inventory-push.ts`), and this remains as the fallback and as the way
 * to pick up a restock — a number only ever raised upstream, which no sale of
 * ours would otherwise reveal.
 *
 * Before it existed, nothing wrote `inventory_baseline` after the first order
 * for a variant: stock could only ratchet downwards, a restock upstream was
 * invisible, and every reconciled sale went on being subtracted forever.
 *
 * The read is deliberately uncached. The admin has just changed these numbers
 * in hPanel and is asking us to pick the change up, so a snapshot up to
 * `HOSTINGER_CATALOG_REVALIDATE` seconds old is exactly the wrong answer —
 * hence invalidating both the Next data cache (by the `catalog` tag the client
 * has always set) and the provider's own in-process snapshot first.
 */
export async function syncInventoryFromHostingerAction(): Promise<void> {
  const actor = await requireAdminActor();

  revalidateTag('catalog');
  invalidateCatalogueSnapshot();

  const products = await allProducts();
  const entries = products.flatMap((product) =>
    product.variants.map((variant) => ({ variantId: variant.id, quantity: variant.stock })),
  );

  if (entries.length === 0) {
    // An empty catalogue almost certainly means the upstream read failed.
    // Writing zeroes would take the whole shop out of stock.
    console.error('[admin] inventory resync aborted: the catalogue returned no products');
    return;
  }

  // Mirror the catalogue before reconciling stock.
  //
  // This is where duplicate SKUs and slugs are caught: `catalogue_skus.sku` is
  // a primary key, so a second product cannot claim one that is taken. A
  // collision that already exists upstream is left on sale and alerted — see
  // `catalogue-sync.ts` for why a sync must never withdraw a live product —
  // and only a genuinely new arrival is quarantined.
  //
  // Errors are deliberately not swallowed. A mirror that fails quietly would
  // stop preventing duplicates while still looking healthy — the precise
  // failure mode `commerce/health.ts` was written to complain about.
  const mirror = await syncCatalogue(products);

  if (mirror.productsQuarantined > 0) {
    console.warn(
      `[admin] catalogue sync quarantined ${mirror.productsQuarantined} new product(s): ` +
        mirror.quarantined.map((row) => `${row.productId} (${row.reason} ${row.subject})`).join(', '),
    );
  }

  if (mirror.productsGrandfathered > 0) {
    console.warn(
      `[admin] ${mirror.productsGrandfathered} existing collision(s) left on sale: ` +
        mirror.grandfathered
          .map((row) => `${row.productId} (${row.reason} ${row.subject})`)
          .join(', '),
    );
  }

  const result = await orders().reconcileInventory(entries);

  console.info(
    `[admin] ${actor} resynced inventory from Hostinger: ` +
      `${result.variants} variant(s), ${result.reservations} sale(s) marked reconciled; ` +
      `catalogue mirror ${mirror.productsActive} active, ` +
      `${mirror.productsGrandfathered} colliding but on sale, ` +
      `${mirror.productsQuarantined} quarantined, ${mirror.alertsRaised} alert(s)`,
  );

  revalidatePath('/admin');
}

/**
 * Acknowledge a catalogue alert.
 *
 * Resolving is not fixing. The duplicate still exists upstream in hPanel; this
 * only records that a human has seen it, so the banner stops competing for
 * attention with problems nobody has looked at yet. If the same collision is
 * observed on the next sync the alert re-opens by itself.
 */
export async function resolveCatalogueAlertAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();

  const kind = String(formData.get('kind') ?? '');
  const subject = String(formData.get('subject') ?? '');
  if (!kind || !subject) return;

  await resolveCatalogueAlert(kind, subject);
  console.info(`[admin] ${actor} acknowledged catalogue alert ${kind}:${subject}`);

  revalidatePath('/admin');
}

/**
 * Push queued stock deductions to Hostinger now.
 *
 * The webhook already drains after each payment, so this is for the cases that
 * did not settle first time: a Hostinger outage, an exhausted retry, or a
 * backlog built up while the push was switched off. Safe to press repeatedly —
 * every job re-reads the live quantity and decides again, so a second press
 * cannot double-decrement.
 */
export async function pushInventoryToHostingerAction(): Promise<void> {
  const actor = await requireAdminActor();

  const outcome = await drainInventoryQueue(50);

  console.info(
    `[admin] ${actor} drained the inventory queue: claimed=${outcome.claimed} ` +
      `applied=${outcome.applied} alreadyApplied=${outcome.alreadyApplied} ` +
      `drift=${outcome.drift} failed=${outcome.failed} skipped=${outcome.skipped}`,
  );

  revalidatePath('/admin');
}
