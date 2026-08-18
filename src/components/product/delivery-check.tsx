'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, MapPin, Wallet, Wrench } from 'lucide-react';
import { checkPincode, type ServiceabilityResult } from '@/lib/support/serviceability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

/**
 * Pincode delivery check.
 *
 * Answers the three questions a shopper has before committing: does it reach
 * me, when, and can I pay on delivery.
 */
export function DeliveryCheck({ installationIncluded }: { installationIncluded: boolean }) {
  const [pincode, setPincode] = React.useState('');
  const [result, setResult] = React.useState<ServiceabilityResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <MapPin className="h-4.5 w-4.5 text-accent-600" />
        <h3 className="font-display text-sm font-semibold text-foreground">
          Delivery &amp; installation
        </h3>
      </div>

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
        <Input
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => {
            setPincode(e.target.value.replace(/\D/g, ''));
            setError(null);
          }}
          placeholder="Enter pincode"
          aria-label="Delivery pincode"
          aria-invalid={Boolean(error)}
          className="tabular"
        />
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
                Delivers to <span className="tabular font-semibold">{result.pincode}</span> in{' '}
                <strong>
                  {result.deliveryDays}–{result.deliveryDays + 1} working days
                </strong>
                .
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

      <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
        Free standard delivery on orders above ₹4,999. Batteries ship in protective crates.
      </p>
    </div>
  );
}
