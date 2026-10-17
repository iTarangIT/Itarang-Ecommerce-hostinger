import { NextResponse } from 'next/server';
import { allProducts } from '@/lib/catalog/collections';
import { linkedProductsForAll } from '@/lib/catalog/linked-products';
import { toProductSummary } from '@/lib/commerce/summary';
import { productAvailability } from '@/lib/catalog/pricing';

/**
 * Recommendations for the cart drawer: linked products only.
 *
 * It used to offer "more batteries" for any cart, which the business called out
 * as unrelated recommendations. Now it answers one question — what does
 * something in this cart need — through `linkedProductsForAll`, which today
 * means a matching charger for an EV battery. A cart with nothing linked gets an
 * empty list and the drawer shows no rail at all.
 *
 * `ids` are the product ids in the cart. Public and cacheable: the response
 * depends on the query string alone.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ids = new Set((params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 50));

  const catalogue = await allProducts();
  const inCart = catalogue.filter((product) => ids.has(product.id));
  const purchasable = catalogue.filter((product) => productAvailability(product) !== 'out-of-stock');

  const products = linkedProductsForAll(inCart, purchasable, 4)
    .filter((product) => !ids.has(product.id))
    .map(toProductSummary);

  return NextResponse.json({ products });
}
