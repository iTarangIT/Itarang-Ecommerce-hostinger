import * as React from 'react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/80 transition-colors hover:border-primary/30 focus:border-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'h-11', className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(CONTROL, 'min-h-[7rem] py-2.5', className)} {...props} />;
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        CONTROL,
        // The chevron moved to `.select-chevron` in globals.css so its one
        // unavoidable colour literal sits beside the token it has to match.
        'select-chevron h-11 cursor-pointer appearance-none pr-9',
        className,
      )}
      {...props}
    />
  );
});

export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="ml-0.5 text-sale">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'h-[18px] w-[18px] shrink-0 cursor-pointer rounded-xs border-2 border-input text-accent accent-[hsl(var(--accent))] transition-colors',
        className,
      )}
      {...props}
    />
  );
}
