/**
 * The purchase kill switch.
 *
 * Buying is switched off across the storefront pending explicit approval. This
 * is a **presentational** gate and nothing more: no shopper can start a
 * purchase from the UI.
 *
 * The gate has two behaviours, and which one a call site uses is deliberate:
 *
 *   Add to cart and Buy now stay **visible but disabled**, with
 *   `PURCHASE_DISABLED_NOTE` as the stated reason. The buttons carry the
 *   catalogue's promise as much as its price — a product page with no Add to
 *   cart at all reads as a broken page rather than as a shop that has not
 *   opened yet, and the layout would shift the day purchase is switched on.
 *
 *   The checkout entry points (cart page, cart drawer) stay **removed**. A
 *   disabled checkout button at the end of a filled cart is a dead end with
 *   nothing behind it, so those surfaces say less rather than more.
 *
 * What it deliberately does NOT do:
 *
 *   Nothing under `lib/payments`, `lib/orders`, `app/api/checkout`,
 *   `app/api/webhooks/payment` or `app/checkout` is changed, disabled or
 *   deleted. Razorpay, order creation, payment verification, the webhook and
 *   inventory reservation all remain exactly as they were and stay covered by
 *   their existing tests. The cart itself still works; only the routes out of
 *   it are closed.
 *
 * Restoring purchase is flipping this one constant back to `true`. The
 * handlers and analytics calls behind each gate were left in place precisely so
 * that flip is all it takes.
 */
// Annotated `boolean` rather than left as the literal `false` on purpose: it
// keeps the compiler from narrowing the purchase branches to unreachable code,
// so they stay type-checked and ready for the flip back to `true`.
export const PURCHASE_ENABLED: boolean = false;

/**
 * Why a purchase control is disabled, stated in one line.
 *
 * Rendered as the tooltip on the wrapper around each disabled button and as a
 * visible helper line beneath it — a greyed button with no explanation leaves
 * the shopper to guess whether the product, the browser or the site is broken.
 */
export const PURCHASE_DISABLED_NOTE = 'Online ordering opens soon.';
