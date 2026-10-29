'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  SUPPORT_FORMS,
  validateForm,
  type FormErrors,
  type FormValues,
} from '@/lib/support/request-forms';
import { submitSupportRequestAction } from '@/lib/support/request-actions';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Checkbox, Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'itarang.expert-popup.v1';
/** A visitor who closed the popup is asked again after this long. */
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Pages where a sales popup would get in the way of a task already under way:
 * paying, signing in, the account area and the back office.
 */
const SKIP_PREFIXES = [
  '/admin',
  '/staff',
  '/checkout',
  '/order',
  '/login',
  '/register',
  '/account',
  '/auth',
  '/forgot-password',
  '/reset-password',
  '/change-password',
  '/verify-email',
];

/** `submitted`, or `dismissed:<epoch ms>`; anything else counts as a first visit. */
function shouldShow(stored: string | null, now = Date.now()): boolean {
  if (!stored) return true;
  if (stored === 'submitted') return false;
  const at = Number(stored.startsWith('dismissed:') ? stored.slice('dismissed:'.length) : NaN);
  return !Number.isFinite(at) || now - at > SNOOZE_MS;
}

function remember(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* non-blocking */
  }
}

const PILL = 'h-12 rounded-full px-5 text-base sm:text-sm';

/**
 * "Connect with an iTarang expert" — the popup a first-time visitor sees,
 * asking for a name, mobile number and pincode so the team can call back.
 *
 * Submissions go through the same support-request pipeline as the Owner Centre
 * forms (kind `callback`): validated against `SUPPORT_FORMS.callback`, rate
 * limited, stored in the admin queue and mailed to the service inbox. Closing
 * it is always allowed; it then stays away for a week, and for good once the
 * visitor has sent their details.
 */
export function ExpertCallbackPopup() {
  const pathname = usePathname() ?? '/';
  const skipped = SKIP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<FormValues>({});
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ name: string; reference: string | null } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const honeypot = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (skipped) return;
    let show = false;
    try {
      show = shouldShow(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      show = false; // storage blocked: the choice could not be remembered, so do not nag
    }
    if (!show) return;
    const timer = window.setTimeout(() => setOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [skipped]);

  const close = React.useCallback(() => {
    setOpen(false);
    if (!done) remember(`dismissed:${Date.now()}`);
  }, [done]);

  const fields = SUPPORT_FORMS.callback;
  const set = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const found = validateForm(fields, values);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    // Filled only by bots that fill every input: thank them and send nothing.
    if (honeypot.current?.value) {
      setDone({ name: values.name ?? '', reference: null });
      return;
    }

    startTransition(async () => {
      const result = await submitSupportRequestAction('callback', values);
      if (result.ok) {
        remember('submitted');
        setDone({ name: values.name ?? '', reference: result.reference });
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message);
      }
    });
  };

  return (
    <Modal open={open} onClose={close} label="Connect with an iTarang expert" className="max-w-md overflow-y-auto">
      {/* Banner: the two hero photos side by side under a brand-coloured wash. */}
      <div className="relative h-44 overflow-hidden bg-primary-900 sm:h-48">
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="relative">
            <Image src="/images/hero/inverter-battery.jpg" alt="" fill sizes="224px" className="object-cover" />
          </div>
          <div className="relative">
            <Image src="/images/hero/e-rickshaw-battery.jpg" alt="" fill sizes="224px" className="object-cover" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-l from-primary-900 via-primary-900/80 to-primary-900/20" />
        <Image
          src="/images/logo-wordmark-light.png"
          alt="iTarang"
          width={111}
          height={28}
          className="absolute left-4 top-4 h-7 w-auto"
        />
        <div className="absolute bottom-5 right-5 text-right text-white">
          <p className="text-sm font-medium sm:text-base">
            Connect with{' '}
            <span className="rounded bg-accent px-1.5 py-0.5 font-bold text-accent-foreground">iTarang</span>
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">
            Expert today
          </p>
        </div>
      </div>

      {done ? (
        <div className="flex flex-col items-center px-6 py-8 text-center sm:px-8">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="mt-3 font-display text-lg font-bold text-foreground">
            Thank you{done.name ? `, ${done.name}` : ''}!
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Our expert will call you shortly to help you choose the right battery.
          </p>
          {done.reference ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Your reference: <span className="tabular font-semibold text-foreground">{done.reference}</span>
            </p>
          ) : null}
          <Button className="mt-6 h-12 rounded-full px-10" onClick={close}>
            Start exploring
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5 px-6 py-6 sm:px-8">
          <p className="text-sm text-muted-foreground">
            Share your details and our battery expert will call you back — free advice, no obligation.
          </p>

          <PopupInput
            name="name"
            placeholder="Full Name"
            autoComplete="name"
            maxLength={120}
            value={values.name ?? ''}
            error={errors.name}
            onChange={set}
          />
          <PopupInput
            name="phone"
            placeholder="Mobile Number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            value={values.phone ?? ''}
            error={errors.phone}
            onChange={(name, value) => set(name, value.replace(/\D/g, ''))}
          />
          <PopupInput
            name="pincode"
            placeholder="Enter Pin Code"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={values.pincode ?? ''}
            error={errors.pincode}
            onChange={(name, value) => set(name, value.replace(/\D/g, ''))}
          />

          {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
          <input
            ref={honeypot}
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
          />

          <label className="mt-1 flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
            <Checkbox
              className="mt-0.5"
              checked={values.consent === 'yes'}
              onChange={(event) => set('consent', event.target.checked ? 'yes' : '')}
            />
            <span>
              By submitting, you agree to our{' '}
              <Link href="/policies/terms" className="font-semibold text-foreground hover:underline">
                Terms of use
              </Link>{' '}
              &amp;{' '}
              <Link href="/policies/privacy" className="font-semibold text-foreground hover:underline">
                Privacy policy
              </Link>{' '}
              and to be contacted by iTarang.
            </span>
          </label>
          {errors.consent ? (
            <p className="-mt-2 text-xs font-medium text-destructive">Please tick to agree before submitting.</p>
          ) : null}

          {formError ? (
            <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {formError}
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={pending || values.consent !== 'yes'}
            className="mx-auto mt-1 w-full max-w-[18rem] rounded-full"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit
          </Button>
        </form>
      )}
    </Modal>
  );
}

function PopupInput({
  name,
  value,
  error,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  name: string;
  value: string;
  error?: string;
  onChange: (name: string, value: string) => void;
}) {
  const errorId = `expert-${name}-error`;
  return (
    <div>
      <Input
        {...props}
        name={name}
        value={value}
        aria-label={props.placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(name, event.target.value)}
        className={cn(PILL, error && 'border-destructive')}
      />
      {error ? (
        <p id={errorId} className="mt-1 px-5 text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
