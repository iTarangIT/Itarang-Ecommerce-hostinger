'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Clock, Info, MapPin, Wrench } from 'lucide-react';
import { checkPincode, type ServiceabilityResult } from '@/lib/support/serviceability';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

/**
 * Technician coverage lookup.
 *
 * Deliberately reports coverage and response expectations rather than listing
 * named partners: we do not have a verified partner directory, and inventing
 * one would be worse than saying so.
 */
export function TechnicianLookup() {
  const [pincode, setPincode] = React.useState('');
  const [result, setResult] = React.useState<ServiceabilityResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 className="heading-3">Check coverage for your pincode</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Enter the pincode where the system is installed and we will tell you whether our service
        network reaches it.
      </p>

      <form
        className="mt-5 flex max-w-sm gap-2"
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
          placeholder="6-digit pincode"
          aria-label="Pincode"
          aria-invalid={Boolean(error)}
          className="tabular"
        />
        <Button type="submit" variant="primary" className="shrink-0">
          Check
        </Button>
      </form>

      {error ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      ) : null}

      {result ? (
        result.serviceable ? (
          <div className="mt-5 rounded-lg border border-success/30 bg-success-soft p-4">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Covered — <span className="tabular">{result.pincode}</span>
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                A certified technician is assigned from the network covering this area.
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                Installation visits are typically scheduled within{' '}
                {result.installationDays}–{result.installationDays + 2} working days.
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/support/installation"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                Book an installation
              </Link>
              <Link
                href="/support/complaint"
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground"
              >
                Register a complaint
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-warning/40 bg-warning-soft p-4">
            <p className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
              <MapPin className="h-5 w-5 text-warning" />
              Not covered yet — <span className="tabular">{result.pincode}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Our network does not reach this pincode at the moment. Call us and we can tell you
              the nearest area we cover, and whether a visit can be arranged from there.
            </p>
          </div>
        )
      ) : null}

      <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Coverage results in this build come from development logic, not the live service network. A
        searchable directory of named service partners is added once that dataset is connected.
      </p>
    </div>
  );
}
