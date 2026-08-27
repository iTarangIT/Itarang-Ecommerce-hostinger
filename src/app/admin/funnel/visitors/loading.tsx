import { Skeleton } from '@/components/ui/skeleton';

/** One grouped aggregate over `funnel_events`, behind the admin session lookup. */
export default function AnonymousVisitorsLoading() {
  return (
    <div className="container py-8">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <Skeleton className="mt-4 h-16 w-full" />

      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-28" />
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
