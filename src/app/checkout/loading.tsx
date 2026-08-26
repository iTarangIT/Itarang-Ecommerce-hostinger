import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/checkout` blocks on `requireUser()` — a session lookup against a remote
 * database — before the first byte. This mirrors the two-column flow so the
 * step panel and the order summary do not jump when they arrive.
 */
export default function CheckoutLoading() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-5 sm:py-7">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-3 h-9 w-44" />
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-4 lg:col-span-7">
            <div className="flex gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-8 flex-1" />
              ))}
            </div>
            <div className="space-y-4 rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="mt-2 h-12 w-44" />
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="space-y-3 rounded-xl border border-border bg-card p-5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-4 h-7 w-40" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
