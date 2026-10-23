import type { OrderStages, OrderStatus } from './types';

/**
 * Where an order is, in words a customer understands. Pure — shared by the
 * /track page, the signed-in order list and their tests.
 *
 * The steps are the statuses an order can actually reach (types.ts). The old
 * /track legend also listed "Out for delivery" and "Installed", which no order
 * ever records, so a customer waited for a step that could not happen.
 *
 * What each status means (also shown to the admin beside the status control):
 *
 *   Waiting for payment  order placed, online payment not yet received
 *   Order placed         the first step; "waiting for payment" until paid
 *   Confirmed            payment received (or a cash-on-delivery order accepted)
 *   Packed               packed and ready for the courier — optional, an order
 *                        may go straight from Confirmed to Shipped
 *   Shipped              handed to the courier / delivery person
 *   Delivered            received by the customer
 *   Cancelled            stopped; stock goes back on the shelf
 */

export type StepKey = 'placed' | 'confirmed' | 'packed' | 'shipped' | 'delivered';

export const TRACK_STEPS: ReadonlyArray<{ key: StepKey; label: string; detail: string }> = [
  { key: 'placed', label: 'Order placed', detail: 'We have your order.' },
  { key: 'confirmed', label: 'Confirmed', detail: 'Payment received; being prepared.' },
  { key: 'packed', label: 'Packed', detail: 'Packed and ready for the courier.' },
  { key: 'shipped', label: 'Shipped', detail: 'On its way with the courier.' },
  { key: 'delivered', label: 'Delivered', detail: 'Received at your address.' },
];

/** Which step each status means; pending_payment is still "placed". */
const STEP_OF: Record<Exclude<OrderStatus, 'cancelled'>, StepKey> = {
  pending_payment: 'placed',
  confirmed: 'confirmed',
  packed: 'packed',
  shipped: 'shipped',
  delivered: 'delivered',
};

/** The stored stage date for each step (migration 0027), when there is one. */
function stageDate(stages: OrderStages | undefined, key: StepKey): string | undefined {
  if (!stages) return undefined;
  switch (key) {
    case 'confirmed':
      return stages.confirmedAt ?? stages.paidAt;
    case 'packed':
      return stages.packedAt;
    case 'shipped':
      return stages.shippedAt;
    case 'delivered':
      return stages.deliveredAt;
    default:
      return undefined;
  }
}

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

const EVENT_LABEL: Record<string, string> = {
  pending_payment: 'Waiting for payment',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  'payment:pending': 'Payment pending',
  'payment:authorized': 'Payment authorised',
  'payment:paid': 'Payment received',
  'payment:failed': 'Payment failed',
  'payment:refunded': 'Payment refunded',
};

/**
 * A history entry in words: "Payment received", not "payment:paid". A note
 * that changed nothing (from a status to the same one) reads "Update".
 */
export function eventLabel(fromStatus: string | null, toStatus: string): string {
  if (fromStatus !== null && fromStatus === toStatus) return 'Update';
  if (fromStatus === null) return 'Order placed';
  return EVENT_LABEL[toStatus] ?? toStatus;
}

export interface TimelineEntry {
  status: string;
  at: string;
}

/**
 * Builds the tracker view. `placedAt` dates the first step; `stages` (the
 * order's stored stage dates) date the others, falling back to the timeline
 * (order events) for orders from before those were stored. A step the order
 * skipped — Packed, when it went straight to Shipped — still counts as done,
 * just without a date.
 */
export function trackView(
  status: OrderStatus,
  placedAt: string,
  timeline: readonly TimelineEntry[] = [],
  stages?: OrderStages,
): TrackView {
  const reached = new Map<string, string>();
  for (const entry of timeline) {
    const prev = reached.get(entry.status);
    if (!prev || entry.at > prev) reached.set(entry.status, entry.at);
  }
  const dateFor = (key: StepKey): string | undefined =>
    key === 'placed' ? placedAt : (stageDate(stages, key) ?? reached.get(key));

  if (status === 'cancelled') {
    // Show how far it got before it was stopped; nothing is "current".
    let lastDone = 0;
    TRACK_STEPS.forEach((step, index) => {
      if (index > 0 && dateFor(step.key)) lastDone = index;
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
