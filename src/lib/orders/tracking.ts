import type { OrderStatus } from './types';

/**
 * Where an order is, in words a customer understands. Pure — shared by the
 * /track page, the signed-in order list and their tests.
 *
 * The steps are the statuses an order can actually reach (types.ts). The old
 * /track legend also listed "Out for delivery" and "Installed", which no order
 * ever records, so a customer waited for a step that could not happen.
 */

export type StepKey = 'placed' | 'confirmed' | 'shipped' | 'delivered';

export const TRACK_STEPS: ReadonlyArray<{ key: StepKey; label: string; detail: string }> = [
  { key: 'placed', label: 'Order placed', detail: 'We have your order.' },
  { key: 'confirmed', label: 'Confirmed', detail: 'Payment received; queued for dispatch.' },
  { key: 'shipped', label: 'Packed & shipped', detail: 'Packed and on its way with the carrier.' },
  { key: 'delivered', label: 'Delivered', detail: 'Received at your address.' },
];

/**
 * Which step each status means; pending_payment is still "placed". Packing is
 * part of shipping now, so an order left in the old `packed` status has not
 * reached the next step yet.
 */
const STEP_OF: Record<Exclude<OrderStatus, 'cancelled'>, StepKey> = {
  pending_payment: 'placed',
  confirmed: 'confirmed',
  packed: 'confirmed',
  shipped: 'shipped',
  delivered: 'delivered',
};

export type StepState = 'done' | 'current' | 'upcoming';

export interface TrackStep {
  key: StepKey;
  label: string;
  detail: string;
  state: StepState;
  /** When the order reached this step, if the timeline records it. */
  at?: string;
}

export interface TrackView {
  steps: TrackStep[];
  /** 0-based index of the current step; -1 for a cancelled order. */
  currentIndex: number;
  cancelled: boolean;
  awaitingPayment: boolean;
  /** One line for the top of the card, e.g. "Shipped — on its way". */
  headline: string;
  /** What happens next, or null when there is nothing left to wait for. */
  next: string | null;
  /** 0–100, for a compact progress bar. */
  percent: number;
}

export interface TimelineEntry {
  status: string;
  at: string;
}

/**
 * Builds the tracker view. `placedAt` dates the first step; the timeline
 * (order events, any order) dates the others — the latest time each status was
 * entered. A later step that the timeline skipped still counts as done.
 */
export function trackView(
  status: OrderStatus,
  placedAt: string,
  timeline: readonly TimelineEntry[] = [],
): TrackView {
  const reached = new Map<string, string>();
  for (const entry of timeline) {
    const prev = reached.get(entry.status);
    if (!prev || entry.at > prev) reached.set(entry.status, entry.at);
  }
  const dateFor = (key: StepKey): string | undefined =>
    key === 'placed' ? placedAt : reached.get(key);

  if (status === 'cancelled') {
    // Show how far it got before it was stopped; nothing is "current".
    let lastDone = 0;
    TRACK_STEPS.forEach((step, index) => {
      if (index > 0 && reached.has(step.key)) lastDone = index;
    });
    return {
      steps: TRACK_STEPS.map((step, index) => ({
        ...step,
        state: index <= lastDone ? 'done' : 'upcoming',
        at: index <= lastDone ? dateFor(step.key) : undefined,
      })),
      currentIndex: -1,
      cancelled: true,
      awaitingPayment: false,
      headline: 'Cancelled',
      next: null,
      percent: 0,
    };
  }

  const currentKey = STEP_OF[status];
  const currentIndex = TRACK_STEPS.findIndex((step) => step.key === currentKey);
  const awaitingPayment = status === 'pending_payment';
  const delivered = status === 'delivered';

  const steps = TRACK_STEPS.map((step, index): TrackStep => {
    const state: StepState =
      index < currentIndex || (delivered && index === currentIndex)
        ? 'done'
        : index === currentIndex
          ? 'current'
          : 'upcoming';
    return { ...step, state, at: state === 'upcoming' ? undefined : dateFor(step.key) };
  });

  const headline = awaitingPayment
    ? 'Waiting for payment'
    : `${TRACK_STEPS[currentIndex].label} — ${TRACK_STEPS[currentIndex].detail.replace(/\.$/, '').toLowerCase()}`;

  const next = awaitingPayment
    ? 'Complete the payment and we will confirm your order.'
    : delivered
      ? null
      : `Next: ${TRACK_STEPS[currentIndex + 1].label.toLowerCase()}.`;

  return {
    steps,
    currentIndex,
    cancelled: false,
    awaitingPayment,
    headline,
    next,
    percent: Math.round((currentIndex / (TRACK_STEPS.length - 1)) * 100),
  };
}
