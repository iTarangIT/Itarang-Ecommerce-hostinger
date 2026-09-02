'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Pencil, Truck, Wallet, Wrench } from 'lucide-react';
import { checkPincode, type ServiceabilityResult } from '@/lib/support/serviceability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

/** The range quoted before a pincode narrows it. */
const DEFAULT_DAYS = '3 – 5 days';

/**
 * Delivery date, with a pincode check to sharpen it.
 *
 * Leads with an answer rather than an empty field: a shopper who never types
 * anything still learns roughly when the product arrives, and entering a
 * pincode replaces the range with a real date window for that address.
 */
export function DeliveryCheck({ installationIncluded }: { installationIncluded: boolean }) {
  const [pincode, setPincode] = React.useState('');
  const [result, setResult] = React.useState<ServiceabilityResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const serviceable = result && result.serviceable ? result : null;

  return (
    <div className="border-y border-border py-4">
      <p className="flex items-center gap-2.5 text-sm text-foreground">
        <Truck className="h-5 w-5 shrink-0 text-accent-600" />
        <span className="h-5 w-px shrink-0 bg-border" />
        Reaching your home in{' '}
        <strong className="font-semibold">
          {serviceable ? `${serviceable.deliveryDays} – ${serviceable.deliveryDays + 1} days` : DEFAULT_DAYS}
        </strong>
      </p>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const outcome = checkPincode(pincode);
          if ('error' in outcome) {
            setError(outcome.error);
            setResult(null);
          } else {
            setError(null);
            setResult(outcome);
          }
        }}
      >
        <div className="relative flex-1">
          <Input
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => {
              setPincode(e.target.value.replace(/\D/g, ''));
              setError(null);
            }}
            placeholder="Enter Pincode to get accurate date"
            aria-label="Delivery pincode"
            aria-invalid={Boolean(error)}
            className="tabular pr-9"
          />
          <Pencil className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Button type="submit" variant="outline" className="shrink-0">
          Check
        </Button>
      </form>

      {error ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : null}

      {result ? (
        result.serviceable ? (
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span className="text-foreground">
                Delivers to <span className="tabular font-semibold">{result.pincode}</span>.
              </span>
            </li>
            {installationIncluded ? (
              <li className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-muted-foreground">
                  Installation is booked from day {result.installationDays} onward, at a slot you
                  choose.
                </span>
              </li>
            ) : null}
            <li className="flex items-start gap-2">
              <Wallet
                className={`mt-0.5 h-4 w-4 shrink-0 ${result.codAvailable ? 'text-success' : 'text-muted-foreground'}`}
              />
              <span className="text-muted-foreground">
                {result.codAvailable
                  ? 'Cash on delivery is available at this pincode.'
                  : 'Cash on delivery is not available at this pincode — prepaid only.'}
              </span>
            </li>
          </ul>
        ) : (
          <p className="mt-3 flex items-start gap-2 text-sm text-warning">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {result.message}
          </p>
        )
      ) : null}
    </div>
  );
}
