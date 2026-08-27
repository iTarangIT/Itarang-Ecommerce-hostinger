import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'outline' | 'ghost' | 'subtle' | 'danger' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

// const VARIANTS: Record<Variant, string> = {
//   primary:
//     'bg-primary text-primary-foreground hover:bg-primary-700 active:bg-primary-900 shadow-card',
//   accent:
//     'bg-accent text-accent-foreground hover:bg-accent-400 active:bg-accent-600 shadow-card font-semibold',
//   outline:
//     'border border-input bg-card text-foreground hover:border-primary/40 hover:bg-secondary active:bg-muted',
//   ghost: 'text-foreground hover:bg-secondary active:bg-muted',
//   subtle: 'bg-secondary text-secondary-foreground hover:bg-muted active:bg-primary-100',
//   danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
//   link: 'text-primary underline-offset-4 hover:underline hover:text-primary-600 p-0 h-auto',
// };

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-600 active:bg-primary-700 shadow-card',

  accent:
    'bg-accent text-accent-foreground hover:bg-accent-400 active:bg-accent-600 shadow-card font-semibold',

  outline:
    'border border-input bg-card text-foreground hover:border-primary/40 hover:bg-secondary active:bg-muted',

  ghost:
    'text-foreground hover:bg-secondary active:bg-muted',

  subtle:
    'bg-secondary text-secondary-foreground hover:bg-muted active:bg-primary-100',

  danger:
    'bg-destructive text-destructive-foreground hover:opacity-90',

  link:
    'text-primary underline-offset-4 hover:underline hover:text-primary-600 p-0 h-auto',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2 sm:h-11',
  lg: 'h-12 px-6 text-base gap-2',
  icon: 'h-11 w-11 shrink-0',
  'icon-sm': 'h-9 w-9 shrink-0',
};

const BASE =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 select-none';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', fullWidth, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...props}
    />
  );
});

export interface ButtonLinkProps extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export function ButtonLink({
  className,
  variant = 'primary',
  size = 'md',
  fullWidth,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full', className)}
      {...props}
    />
  );
}
