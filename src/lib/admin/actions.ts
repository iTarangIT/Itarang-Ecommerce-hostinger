'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { orders } from '@/lib/orders/postgres-repository';
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
