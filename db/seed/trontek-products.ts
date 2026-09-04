import type { ProductSeed } from '../../src/lib/products/seed-types.ts';
import { TRONTEK_EV_PRODUCTS } from './trontek-ev-products.ts';
import { TRONTEK_HOME_PRODUCTS } from './trontek-home-products.ts';

export { MANUFACTURERS, SELLERS } from './trontek-shared.ts';

/**
 * The catalogue, as one list.
 *
 * Split across three files because the two ranges have almost nothing in
 * common. A home storage battery is described by its inverter compatibility,
 * its IP rating and a design life in years; a traction pack by its system
 * voltage, its charge profile, its connector pin map and a cycle count. The
 * only content they share is who makes and sells them, which is why that lives
 * in `trontek-shared.ts` and is pointed at rather than repeated.
 */
export const TRONTEK_PRODUCTS: ProductSeed[] = [
  ...TRONTEK_HOME_PRODUCTS,
  ...TRONTEK_EV_PRODUCTS,
];
