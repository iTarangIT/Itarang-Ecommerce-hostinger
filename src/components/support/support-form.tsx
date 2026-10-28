'use client';

import * as React from 'react';
import { AlertCircle, CheckCircle2, Copy, Loader2 } from 'lucide-react';
import {
  SUPPORT_FORMS,
  validateForm,
  type FormErrors,
  type FormFieldSpec,
  type FormValues,
  type SupportRequestKind,
} from '@/lib/support/request-forms';
import { submitSupportRequestAction } from '@/lib/support/request-actions';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';

export type { FieldType, FormFieldSpec } from '@/lib/support/request-forms';

/**
 * Shared Owner Centre form.
 *
 * The fields come from `request-forms.ts`, which the server validates against
 * too, so this checks the same rules before sending and the server has the
 * final say. On success the customer sees the reference the server issued —
 * the request is stored and the service inbox has it.
 */
export function SupportForm({
  kind,
  submitLabel,
  successTitle,
  successBody,
  initialValues,
}: {
  kind: SupportRequestKind;
  submitLabel: string;
  successTitle: string;
  successBody: string;
  /** Prefill, e.g. the calculator result an enquiry was started from. */
  initialValues?: FormValues;
}) {
  const fields: FormFieldSpec[] = SUPPORT_FORMS[kind];
  const [values, setValues] = React.useState<FormValues>(initialValues ?? {});
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [reference, setReference] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [copied, setCopied] = React.useState(false);
  const summaryRef = React.useRef<HTMLDivElement>(null);

  if (reference) {
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

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">Your reference</p>
            <p className="tabular font-display text-xl font-bold tracking-wide text-foreground">
              {reference}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              navigator.clipboard?.writeText(reference).then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            <Copy className="h-4 w-4" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>

        <dl className="mt-4 space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
          {fields
            .filter((field) => (values[field.name] ?? '').trim())
            .map((field) => (
              <div key={field.name} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="text-muted-foreground sm:w-48 sm:shrink-0">{field.label}</dt>
                <dd className="font-medium text-foreground">{values[field.name]}</dd>
              </div>
            ))}
        </dl>

        <Button
          variant="outline"
          className="mt-5"
          onClick={() => {
            setReference(null);
            setValues({});
            setCopied(false);
          }}
        >
          Start another request
        </Button>
      </div>
    );
  }

  const submit = () => {
    const found = validateForm(fields, values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) {
      document.getElementById(Object.keys(found)[0]!)?.focus();
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitSupportRequestAction(kind, values);
        if (result.ok) {
          setReference(result.reference);
          window.setTimeout(() => summaryRef.current?.focus(), 40);
        } else {
          setErrors(result.fieldErrors ?? {});
          setFormError(result.message);
        }
      } catch {
        setFormError('We could not reach the server. Please try again.');
      }
    });
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
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
                  maxLength={field.maxLength}
                  aria-invalid={Boolean(errors[field.name])}
                />
              ) : (
                <Input
                  id={field.name}
                  name={field.name}
                  type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'}
                  inputMode={
                    field.type === 'tel' || field.type === 'pincode' ? 'numeric' : undefined
                  }
                  autoComplete={
                    field.name === 'name'
                      ? 'name'
                      : field.type === 'tel'
                        ? 'tel-national'
                        : field.type === 'email'
                          ? 'email'
                          : field.type === 'pincode'
                            ? 'postal-code'
                            : undefined
                  }
                  maxLength={
                    field.maxLength ??
                    (field.type === 'tel' ? 10 : field.type === 'pincode' ? 6 : 200)
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

      {formError ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {formError}
        </p>
      ) : null}

      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? 'Sending…' : submitLabel}
      </Button>
      <p className="text-xs text-muted-foreground">
        We use these details only to handle your request.
      </p>
    </form>
  );
}
