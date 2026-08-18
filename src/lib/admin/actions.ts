'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { orders } from '@/lib/orders/postgres-repository';
import { canTransitionOrder } from '@/lib/orders/state-machine';
import type { OrderStatus } from '@/lib/orders/types';
import {
  checkAdminPassword,
  createAdminSession,
  destroyAdminSession,
  isAdminAuthenticated,
  isAdminConfigured,
} from './session';

/** Sign in to the local order console. */
export async function loginAction(
  _previous: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  if (!isAdminConfigured()) {
    return {
      error:
        'Admin access is not configured. Run `npm run admin:hash -- "your password"` and add the ' +
        'two values it prints to .env.local.',
    };
  }

  const password = String(formData.get('password') ?? '');
  if (!checkAdminPassword(password)) {
    // Deliberately vague — no hint about which part was wrong.
    return { error: 'Incorrect password.' };
  }

  await createAdminSession();
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await destroyAdminSession();
  redirect('/admin/login');
}

/**
 * Move an order to its next fulfilment state.
 *
 * The transition is validated against the state machine, so the console cannot
 * put an order into an impossible state even if the form is tampered with.
 */
export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect('/admin/login');

  const orderNumber = String(formData.get('orderNumber') ?? '');
  const to = String(formData.get('status') ?? '') as OrderStatus;
  const note = String(formData.get('note') ?? '').trim() || undefined;

  const repository = orders();
  const order = await repository.findByOrderNumber(orderNumber);
  if (!order) return;

  if (!canTransitionOrder(order.status, to)) return;

  await repository.transitionOrderStatus(order.id, to, 'admin', note);

  revalidatePath('/admin');
  revalidatePath(`/admin/orders/${orderNumber}`);
}
