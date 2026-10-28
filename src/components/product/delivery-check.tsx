'use client';

import * as React from 'react';
import { CheckCircle2, Loader2, MapPin, Truck, XCircle } from 'lucide-react';
import {
  deliveryDateAfter,
  isPincode,
  type ServiceabilityResult,
} from '@/lib/support/serviceability';
import { PINCODE_KEY, checkPincode } from '@/lib/support/pincode-store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * "Check delivery" on the product page.
 *
 * Asks `/api/pincode`, which reads the coverage list. The last pincode is
 * remembered in this browser only (it is not personal enough to store
 * anywhere else, and convenient enough to keep) and checked again on the next
 * product page, so a shopper types it once. The answer is shared through
 * `pincode-store`, so the header shows it too (R-10).
 */
export function DeliveryCheck() {
  const [pincode, setPincode] = React.useState('');
  const [result, setResult] = React.useState<ServiceabilityResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const check = React.useCallback(async (code: string) => {
    if (!isPincode(code)) {
      setError('Enter a valid 6-digit pincode.');
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    const outcome = await checkPincode(code);
    if (outcome.ok) {
      setResult(outcome.result);
    } else {
      setError(outcome.error);
      setResult(null);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(PINCODE_KEY);
    } catch {
      saved = null;
    }
    if (saved && isPincode(saved)) {
      setPincode(saved);
      void check(saved);
    }
  }, [check]);

  const date = result?.serviceable
    ? deliveryDateAfter(result.deliveryDays).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Truck className="h-4 w-4 text-primary" />
        Check delivery
      </p>
      <form
        className="mt-2.5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void check(pincode);
        }}
      >
        <label htmlFor="delivery-pincode" className="sr-only">
          Delivery pincode
        </label>
        <div className="relative flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="delivery-pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter pincode"
            className="tabular h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="h-10" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
        </Button>
      </form>

      {error ? <p className="mt-2 text-xs font-medium text-destructive">{error}</p> : null}

      {result ? (
        <div
          className={cn(
            'mt-2.5 flex items-start gap-2 text-sm',
            result.serviceable ? 'text-foreground' : 'text-destructive',
          )}
        >
          {result.serviceable ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>
            {result.serviceable && result.confirmed && date ? (
              <>
                Get it by <strong className="font-semibold">{date}</strong>
                {result.city ? ` in ${result.city}` : ''}.
              </>
            ) : (
              result.message
            )}
            {result.serviceable && result.codAvailable ? (
              <span className="block text-xs text-muted-foreground">Cash on delivery available.</span>
            ) : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
