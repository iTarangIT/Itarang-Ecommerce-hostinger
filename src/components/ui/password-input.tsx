'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/field';

/**
 * A password field with a show/hide toggle.
 *
 * Its own file because `field.tsx` is used by server components and this needs
 * state. The toggle is `type="button"` so it never submits the form, and it
 * only switches the input's type: the value, name and autocomplete are
 * untouched, so password managers keep working.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
});
