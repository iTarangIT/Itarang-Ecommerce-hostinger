import { Check, CheckCircle2, Clock, CreditCard, MapPin, Package, PackageCheck, Truck, XCircle } from 'lucide-react';
import type { StepKey, TrackView } from '@/lib/orders/tracking';
import { cn, formatDate } from '@/lib/utils';

const ICON: Record<StepKey, typeof Package> = {
  placed: CreditCard,
  confirmed: CheckCircle2,
  packed: PackageCheck,
  shipped: Truck,
  delivered: MapPin,
};

/**
 * The order's journey as one picture: done steps ticked with their date, the
 * current step highlighted, the rest greyed. Horizontal from `sm`, vertical on
 * phones so every label stays readable.
 */
export function OrderProgress({ view }: { view: TrackView }) {
  return (
    <div>
      <StatusBanner view={view} />

      {/* Horizontal — sm and up */}
      <ol className="mt-6 hidden grid-cols-5 sm:grid" aria-label="Order progress">
        {view.steps.map((step, index) => {
          const Icon = ICON[step.key];
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute right-1/2 top-5 h-1 w-full -translate-y-1/2 rounded-full',
                    step.state === 'upcoming' ? 'bg-border' : 'bg-success',
                  )}
                />
              ) : null}
              <StepDot state={step.state} cancelled={view.cancelled} icon={Icon} />
              <span
                className={cn(
                  'mt-2 text-sm font-semibold',
                  step.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                {step.label}
              </span>
              <span className="mt-0.5 px-1 text-xs text-muted-foreground">
                {step.at ? formatDate(step.at) : step.state === 'current' ? 'Now' : ' '}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Vertical — phones */}
      <ol className="mt-6 sm:hidden" aria-label="Order progress">
        {view.steps.map((step, index) => {
          const Icon = ICON[step.key];
          return (
            <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {index < view.steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute left-5 top-10 h-[calc(100%-2.5rem)] w-1 -translate-x-1/2 rounded-full',
                    view.steps[index + 1].state === 'upcoming' ? 'bg-border' : 'bg-success',
                  )}
                />
              ) : null}
              <StepDot state={step.state} cancelled={view.cancelled} icon={Icon} />
              <span className="min-w-0 pt-1">
                <span
                  className={cn(
                    'block text-sm font-semibold',
                    step.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {step.label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {step.at ? formatDate(step.at) : step.state === 'current' ? 'Now' : step.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepDot({
  state,
  cancelled,
  icon: Icon,
}: {
  state: 'done' | 'current' | 'upcoming';
  cancelled: boolean;
  icon: typeof Package;
}) {
  return (
    <span
      className={cn(
        'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2',
        state === 'done' && 'border-success bg-success text-success-foreground',
        state === 'current' && 'border-accent bg-accent text-accent-foreground ring-4 ring-accent/25',
        state === 'upcoming' && 'border-border bg-card text-muted-foreground',
        cancelled && state === 'done' && 'border-muted-foreground bg-muted-foreground',
      )}
    >
      {state === 'done' ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
    </span>
  );
}

function StatusBanner({ view }: { view: TrackView }) {
  if (view.cancelled) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span>
          <strong className="font-semibold text-foreground">This order was cancelled.</strong> Any
          payment taken is refunded to the original method.
        </span>
      </p>
    );
  }
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg p-3',
        view.awaitingPayment ? 'bg-warning-soft' : view.next ? 'bg-accent/10' : 'bg-success-soft',
      )}
    >
      {view.awaitingPayment ? (
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      ) : view.next ? (
        <Truck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
      )}
      <span>
        <span className="block text-base font-bold text-foreground">{view.headline}</span>
        {view.next ? <span className="block text-sm text-muted-foreground">{view.next}</span> : null}
      </span>
    </div>
  );
}

/** A thin bar for order lists: how far along, in one glance. */
export function OrderProgressBar({ view }: { view: TrackView }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-border"
      role="progressbar"
      aria-valuenow={view.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={view.headline}
    >
      <div
        className={cn('h-full rounded-full', view.cancelled ? 'bg-muted-foreground' : 'bg-success')}
        style={{ width: `${view.cancelled ? 100 : Math.max(view.percent, 6)}%` }}
      />
    </div>
  );
}
