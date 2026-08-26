import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/admin` is `force-dynamic` and runs the order count, the order page and the
 * reconciliation report before it can render. It is also the surface an admin
 * paginates through repeatedly, so every click paid the full round trip with no
 * feedback.
 *
 * This covers the admin layout's `requireAdmin()` check too, which is itself a
 * database query on every navigation under `/admin`.
 */
export default function AdminLoading() {
  return (
    <div className="container py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-24" />
      </div>

      {/* Order table */}
      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="divide-y divide-border bg-card">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
