'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
import { allProducts } from '@/lib/catalog/collections';
import { invalidateCatalogueSnapshot } from '@/lib/commerce/health';
import { canTransitionOrder } from '@/lib/orders/state-machine';
import type { OrderStatus } from '@/lib/orders/types';

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
  const note = String(formData.get('note') ?? '').trim() || undefined;

  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) return;

  if (!canTransitionOrder(order.status, to)) return;

  // The actor is the admin's email rather than the literal string 'admin', so
  // the order history answers *who* changed it, not just that somebody did.
  await repository.transitionOrderStatus(order.id, to, actor, note);

  revalidatePath('/admin');
  revalidatePath(`/admin/orders/${orderNumber}`);
}

/**
 * Re-mirror Hostinger's stock after the admin has deducted sold units in hPanel.
 *
 * Hostinger exposes no inventory write API, so our ledger and the merchant's
 * own figures can only be brought back together by hand. Until this existed
 * nothing ever wrote `inventory_baseline` after the first order for a variant:
 * stock could only ratchet downwards, a restock upstream was invisible, and
 * every reconciled sale went on being subtracted forever.
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

  const result = await orders().reconcileInventory(entries);

  console.info(
    `[admin] ${actor} resynced inventory from Hostinger: ` +
      `${result.variants} variant(s), ${result.reservations} sale(s) marked reconciled`,
  );

  revalidatePath('/admin');
}
