import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Test-mode notice.
 *
 * Deliberately loud and always visible during checkout. Nothing in this build
 * takes money, and the interface should never let anyone believe otherwise.
 */
export function TestModeBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft p-4',
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
      <div className="text-sm">
        <p className="font-display font-bold text-foreground">
          Test mode — no payment is taken and no money moves
        </p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          This checkout runs against a local test database with a simulated payment step. Orders
          placed here are marked as test records and are not real purchases. Nothing is dispatched.
        </p>
      </div>
    </div>
  );
}
