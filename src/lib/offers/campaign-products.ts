import 'server-only';
import { productRepository } from '@/lib/products/postgres-repository';
import type { PickerProduct } from '@/components/admin/campaign-products-field';

/** Enough products for any catalogue this shop will have; the picker scrolls. */
const LIMIT = 2000;

/**
 * Every product an admin might put on a campaign — published and draft, never
 * archived — keyed by product key, which is what `CartItem.productId` carries
 * at checkout. A database that cannot be read gives an empty list, so the
 * campaign form still opens and categories can still be picked.
 */
export async function campaignProductOptions(): Promise<PickerProduct[]> {
  try {
    const { items } = await productRepository().listForAdmin({ limit: LIMIT, offset: 0 });
    return items
      .filter((item) => item.status !== 'archived')
      .map((item) => ({
        key: item.productKey,
        title: item.title,
        category: item.category,
        subcategory: item.subcategory,
        draft: item.status === 'draft',
      }))
      .sort((a, b) => a.title.localeCompare(b.title, 'en-IN'));
  } catch (error) {
    console.error('[admin] campaign product list unavailable:', error);
    return [];
  }
}
