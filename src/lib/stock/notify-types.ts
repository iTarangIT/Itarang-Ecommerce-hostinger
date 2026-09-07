/**
 * The shape of the "Notify me" control's opening state.
 *
 * Split from `notify-state.ts` because the buy box is a client component and
 * needs the constant, while resolving the state needs `currentUser()` — and
 * that reaches for `next/headers`, which cannot be bundled for the browser.
 * Importing the value from the resolver pulled the whole server module into the
 * client graph and failed the build.
 *
 * This file therefore imports nothing.
 */
export interface NotifyState {
  /** Prefill for the address field; null for a guest. */
  email: string | null;
  /**
   * The variant this customer is already waiting for, if any.
   *
   * A SKU rather than a boolean: a shopper can switch variants on the page, and
   * "you are on the list" is true of one pack and not of its neighbour. The
   * control compares this against whichever variant is selected.
   */
  subscribedSku: string | null;
}

export const NO_NOTIFY_STATE: NotifyState = { email: null, subscribedSku: null };
