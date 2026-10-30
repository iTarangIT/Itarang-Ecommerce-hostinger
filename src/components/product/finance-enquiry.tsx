'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Landmark, Loader2 } from 'lucide-react';
import { SUPPORT_FORMS, validateForm, type FormErrors, type FormValues } from '@/lib/support/request-forms';
import { submitFinanceEnquiryAction } from '@/lib/support/finance-actions';
import type { FinanceItemInput, FinancePage } from '@/lib/support/finance-enquiry';
import { formatPrice } from '@/lib/catalog/pricing';
import { Modal } from '@/components/ui/overlay';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * "Buy on finance" (R-15): a button that opens a short form — name, mobile,
 * pincode — with the product already filled in, and files a finance enquiry.
 *
 * The product shown here is for the shopper's reassurance only. What the team
 * and the CRM receive is resolved on the server from the variants (`items`), so it
 * always matches the catalogue. The enquiry is saved by the store before it is
 * forwarded anywhere, which is why the confirmation can promise a call without
 * knowing whether the CRM is up.
 *
 * It names no lender and offers no terms: there is no finance partner
 * agreement to advertise (D-07), only a call from the team.
 */
export function FinanceEnquiry({
  page,
  items,
  summary,
  pricePaise = null,
  className,
}: {
  page: FinancePage;
  /** What is being financed: one variant on a product page, the cart at checkout. */
  items: FinanceItemInput[];
  /** How the product reads in the form, e.g. its title. */
  summary: string;
  pricePaise?: number | null;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<FormValues>({});
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ reference: string | null } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const honeypot = React.useRef<HTMLInputElement>(null);
  const fields = SUPPORT_FORMS.finance;
  const idPrefix = React.useId();

  const set = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: '' }));
  };

  const close = () => {
    setOpen(false);
    // A sent enquiry is not kept open for a second one about the same thing.
    if (done) {
      setDone(null);
      setValues({});
    }
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
      setDone({ reference: null });
      return;
    }

    startTransition(async () => {
      const result = await submitFinanceEnquiryAction({ values, page, items });
      if (result.ok) {
        setDone({ reference: result.reference });
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.message);
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        fullWidth
        className={className}
        onClick={() => setOpen(true)}
      >
        <Landmark className="h-4 w-4" />
        Buy on finance
      </Button>

      <Modal open={open} onClose={close} label="Buy on finance" className="max-w-md overflow-y-auto">
        {done ? (
          <div className="flex flex-col items-center px-6 py-8 text-center sm:px-8">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="mt-3 font-display text-lg font-bold text-foreground">Thank you</p>
            <p className="mt-1 text-sm text-muted-foreground">We will call you within one working day.</p>
            {done.reference ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Your reference: <span className="tabular font-semibold text-foreground">{done.reference}</span>
              </p>
            ) : null}
            <Button className="mt-6" onClick={close}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-6 py-6 sm:px-8">
            <div className="pr-10">
              <h2 className="heading-3">Buy on finance</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Leave your details and our team will call you about paying in instalments.
              </p>
            </div>

            <div className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm">
              <p className="text-2xs uppercase tracking-wide text-muted-foreground">Product</p>
              <p className="font-medium text-foreground">{summary}</p>
              {pricePaise ? <p className="tabular text-muted-foreground">{formatPrice(pricePaise)}</p> : null}
            </div>

            <FinanceInput
              id={`${idPrefix}-name`}
              name="name"
              label="Full name"
              autoComplete="name"
              maxLength={120}
              values={values}
              errors={errors}
              onChange={set}
            />
            <FinanceInput
              id={`${idPrefix}-phone`}
              name="phone"
              label="Mobile number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              values={values}
              errors={errors}
              onChange={(name, value) => set(name, value.replace(/\D/g, ''))}
            />
            <FinanceInput
              id={`${idPrefix}-pincode`}
              name="pincode"
              label="Pincode"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              values={values}
              errors={errors}
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

            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
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

            <Button type="submit" size="lg" disabled={pending || values.consent !== 'yes'} fullWidth>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Request a call
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}

function FinanceInput({
  id,
  name,
  label,
  values,
  errors,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  id: string;
  name: string;
  label: string;
  values: FormValues;
  errors: FormErrors;
  onChange: (name: string, value: string) => void;
}) {
  const error = errors[name];
  return (
    <Field label={label} htmlFor={id} required error={error || undefined}>
      <Input
        {...props}
        id={id}
        name={name}
        value={values[name] ?? ''}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(name, event.target.value)}
        className={cn(error && 'border-destructive')}
      />
    </Field>
  );
}
