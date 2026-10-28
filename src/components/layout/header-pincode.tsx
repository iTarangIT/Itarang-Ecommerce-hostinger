'use client';

import * as React from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { isPincode } from '@/lib/support/serviceability';
import { checkPincode, useSavedPincode } from '@/lib/support/pincode-store';
import { cn } from '@/lib/utils';

/**
 * "Delivering to 122001 · Gurugram · Change", on every page (R-10).
 *
 * Reads the pincode the shopper last checked anywhere on the site and lets them
 * change it in place. Nothing is sent anywhere but the coverage lookup; the
 * answer stays in this browser (`pincode-store`).
 */
export function HeaderPincode({ className }: { className?: string }) {
  const saved = useSavedPincode();
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!editing) return;
    const close = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setEditing(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [editing]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isPincode(value)) {
      setError('Enter a valid 6-digit pincode.');
      return;
    }
    setLoading(true);
    setError(null);
    const outcome = await checkPincode(value);
    setLoading(false);
    if (outcome.ok) setEditing(false);
    else setError(outcome.error);
  };

  return (
    <div ref={panelRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => {
          setValue(saved?.pincode ?? '');
          setError(null);
          setEditing((open) => !open);
        }}
        aria-expanded={editing}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary-600"
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
        {saved ? (
          <span>
            Delivering to <strong className="tabular font-semibold text-foreground">{saved.pincode}</strong>
            {saved.city ? ` · ${saved.city}` : ''}
            <span className="ml-1.5 font-medium text-primary">Change</span>
          </span>
        ) : (
          <span>
            Enter your pincode <span className="font-medium text-primary">for delivery dates</span>
          </span>
        )}
      </button>

      {editing ? (
        <form
          onSubmit={submit}
          className="absolute left-0 top-full z-[60] mt-2 w-64 rounded-lg border border-border bg-card p-3 shadow-lg"
        >
          <label htmlFor="header-pincode" className="text-xs font-semibold text-foreground">
            Delivery pincode
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="header-pincode"
              autoFocus
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              value={value}
              onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
              className="tabular h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={loading}
              className="h-9 shrink-0 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </button>
          </div>
          {error ? <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
