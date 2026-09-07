import { currentUser } from '@/lib/auth/session';
import type { Product } from '@/lib/commerce/types';
import { productAvailability } from '@/lib/catalog/pricing';
import { hasStockNotification } from './notifications';
import { NO_NOTIFY_STATE, type NotifyState } from './notify-types';

// Re-exported so a server component can take both from one import.
export { NO_NOTIFY_STATE };
export type { NotifyState };

/**
 * Resolve the control's opening state, doing no work when it will not render.
 *
 * The early return matters: this is on the critical path of every product page,
 * and the control only appears on a sold-out one. An in-stock product — which
 * is all of them today — costs a session read and nothing else.
 */
export async function notifyStateFor(product: Product): Promise<NotifyState> {
  if (productAvailability(product) !== 'out-of-stock') return NO_NOTIFY_STATE;

  const user = await currentUser();
  if (!user) return NO_NOTIFY_STATE;

  // Checked against the default variant, which is the one the page opens on.
  // Switching to another shows the form again, which is correct — the customer
  // has not asked about that one.
  const sku = product.variants[0]?.sku ?? '';
  const subscribed = await hasStockNotification(product.id, sku, user.email);

  return { email: user.email, subscribedSku: subscribed ? sku : null };
}
