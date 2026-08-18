'use client';

import * as React from 'react';
import { CheckCircle2, Info, Mail, Phone } from 'lucide-react';
import { SITE } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';

export type FieldType = 'text' | 'tel' | 'email' | 'pincode' | 'select' | 'date' | 'textarea';

export interface FormFieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: string[];
  maxLength?: number;
}

type Values = Record<string, string>;
type Errors = Record<string, string>;

function validate(fields: FormFieldSpec[], values: Values): Errors {
  const errors: Errors = {};

  for (const field of fields) {
    const value = (values[field.name] ?? '').trim();

    if (field.required && !value) {
      errors[field.name] = `${field.label} is required.`;
      continue;
    }
    if (!value) continue;

    if (field.type === 'tel' && !/^[6-9]\d{9}$/.test(value)) {
      errors[field.name] = 'Enter a 10-digit Indian mobile number.';
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      errors[field.name] = 'Enter a valid email address.';
    }
    if (field.type === 'pincode' && !/^\d{6}$/.test(value)) {
      errors[field.name] = 'Enter a valid 6-digit pincode.';
    }
  }

  return errors;
}

/**
 * Shared Owner Centre form.
 *
 * PHASE 1: validation, error handling and the confirmation state are all real,
 * but nothing is transmitted — there is no service desk endpoint yet. The
 * confirmation says so explicitly rather than implying a ticket was raised.
 */
export function SupportForm({
  fields,
  submitLabel,
  successTitle,
  successBody,
}: {
  fields: FormFieldSpec[];
  submitLabel: string;
  successTitle: string;
  successBody: string;
}) {
  const [values, setValues] = React.useState<Values>({});
  const [errors, setErrors] = React.useState<Errors>({});
  const [submitted, setSubmitted] = React.useState(false);
  const summaryRef = React.useRef<HTMLDivElement>(null);

  if (submitted) {
    return (
      <div
        ref={summaryRef}
        tabIndex={-1}
        className="rounded-xl border border-success/30 bg-success-soft p-6"
      >
        <p className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <CheckCircle2 className="h-5 w-5 text-success" />
          {successTitle}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{successBody}</p>

        <dl className="mt-5 space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          {fields
            .filter((field) => (values[field.name] ?? '').trim())
            .map((field) => (
              <div key={field.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="text-muted-foreground sm:w-48 sm:shrink-0">{field.label}</dt>
                <dd className="font-medium text-foreground">{values[field.name]}</dd>
              </div>
            ))}
        </dl>

        <div className="mt-5 rounded-lg border border-border bg-card p-4">
          <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
            Not yet sent to the service desk
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            This is the front-end build — the request has been prepared but not transmitted.
            Until the service desk integration lands, send these details to us directly and we
            will raise the request for you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`mailto:${SITE.email}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/50"
            >
              <Mail className="h-4 w-4" />
              {SITE.email}
            </a>
            <a
              href={SITE.phoneHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-accent/50"
            >
              <Phone className="h-4 w-4" />
              {SITE.phone}
            </a>
          </div>
        </div>

        <Button
          variant="outline"
          className="mt-5"
          onClick={() => {
            setSubmitted(false);
            setValues({});
          }}
        >
          Start another request
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const found = validate(fields, values);
        setErrors(found);
        if (Object.keys(found).length === 0) {
          setSubmitted(true);
          window.setTimeout(() => summaryRef.current?.focus(), 40);
        } else {
          const firstError = Object.keys(found)[0];
          document.getElementById(firstError)?.focus();
        }
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const isWide = field.type === 'textarea';
          const value = values[field.name] ?? '';
          const setValue = (next: string) => {
            setValues((v) => ({ ...v, [field.name]: next }));
            setErrors((e) => {
              const copy = { ...e };
              delete copy[field.name];
              return copy;
            });
          };

          return (
            <Field
              key={field.name}
              label={field.label}
              htmlFor={field.name}
              required={field.required}
              hint={field.hint}
              error={errors[field.name]}
              className={isWide ? 'sm:col-span-2' : undefined}
            >
              {field.type === 'select' ? (
                <Select
                  id={field.name}
                  name={field.name}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={Boolean(errors[field.name])}
                >
                  <option value="">Select…</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : field.type === 'textarea' ? (
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={field.placeholder}
                  aria-invalid={Boolean(errors[field.name])}
                />
              ) : (
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type === 'date' ? 'date' : 'text'}
                  inputMode={
                    field.type === 'tel' || field.type === 'pincode' ? 'numeric' : undefined
                  }
                  maxLength={
                    field.maxLength ?? (field.type === 'tel' ? 10 : field.type === 'pincode' ? 6 : undefined)
                  }
                  value={value}
                  onChange={(e) =>
                    setValue(
                      field.type === 'tel' || field.type === 'pincode'
                        ? e.target.value.replace(/\D/g, '')
                        : e.target.value,
                    )
                  }
                  placeholder={field.placeholder}
                  aria-invalid={Boolean(errors[field.name])}
                  className={field.type === 'tel' || field.type === 'pincode' ? 'tabular' : undefined}
                />
              )}
            </Field>
          );
        })}
      </div>

      <Button type="submit" variant="accent" size="lg">
        {submitLabel}
      </Button>
      <p className="text-xs text-muted-foreground">
        We use these details only to handle your request.
      </p>
    </form>
  );
}
