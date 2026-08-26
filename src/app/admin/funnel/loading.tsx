import { Skeleton } from '@/components/ui/skeleton';

/**
 * The funnel page runs four aggregate queries — nine stage counts, attribution
 * coverage and the customer table — behind the admin layout's own session
 * lookup, so it is at least as slow to first byte as Analytics.
 */
export default function FunnelLoading() {
  return (
    <div className="container py-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-52" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-14 w-full rounded-lg" />

      {/* Range controls */}
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28" />
        ))}
      </div>

      {/* Stage table */}
      <Skeleton className="mt-6 h-6 w-24" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>

      {/* Conversion tiles */}
      <Skeleton className="mt-8 h-6 w-32" />
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      {/* Customers */}
      <Skeleton className="mt-8 h-6 w-32" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
