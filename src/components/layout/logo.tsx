import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * iTarang wordmark. The bolt mark and amber full stop carry over from the
 * existing storefront's identity.
 */
export function Logo({
  className,
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'inverse';
}) {
  return (
    <Link
      href="/"
      aria-label="iTarang Products — home"
      className={cn('group inline-flex items-center gap-2.5', className)}
    >
      <span
        className={cn(
          'grid h-9 w-9 place-items-center rounded-md transition-colors',
          tone === 'inverse' ? 'bg-accent text-primary-900' : 'bg-primary text-accent',
        )}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
          <path d="M13.4 2.1a.55.55 0 0 1 .96.5l-1.9 5.9a.6.6 0 0 0 .57.79h5.1a.85.85 0 0 1 .64 1.4l-8.9 10.2a.55.55 0 0 1-.95-.5l1.9-5.9a.6.6 0 0 0-.57-.79H5.2a.85.85 0 0 1-.64-1.4z" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-lg font-bold tracking-tight',
            tone === 'inverse' ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          iTarang
          <span className="text-accent">.</span>
        </span>
        <span
          className={cn(
            'mt-0.5 hidden text-[0.6rem] font-medium uppercase tracking-[0.18em] sm:block',
            tone === 'inverse' ? 'text-primary-foreground/60' : 'text-muted-foreground',
          )}
        >
          Power Products
        </span>
      </span>
    </Link>
  );
}
