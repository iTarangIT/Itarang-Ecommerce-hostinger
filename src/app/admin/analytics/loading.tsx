import { Skeleton } from '@/components/ui/skeleton';

/**
 * The analytics page runs five aggregate queries behind the admin layout's own
 * session lookup, so it is the slowest screen in the console to first byte.
 */
export default function AnalyticsLoading() {
  return (
    <div className="container py-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-14 w-full rounded-lg" />

      {/* Range controls */}
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28" />
        ))}
      </div>

      {/* Revenue tiles */}
      <Skeleton className="mt-6 h-6 w-32" />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      {/* Fulfilment tiles */}
      <Skeleton className="mt-8 h-6 w-56" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      {/* Trend */}
      <Skeleton className="mt-8 h-6 w-44" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}
