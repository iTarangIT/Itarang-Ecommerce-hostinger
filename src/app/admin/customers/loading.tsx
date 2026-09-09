import { Skeleton } from '@/components/ui/skeleton';

/**
 * Four queries, one of which aggregates every order line in the window into a
 * per-customer product list. Worth a skeleton rather than a blank screen.
 */
export default function AdminCustomersLoading() {
  return (
    <div className="container py-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-72" />
      <Skeleton className="mt-2 h-4 w-full max-w-3xl" />
      <Skeleton className="mt-5 h-10 w-full max-w-2xl rounded-lg" />

      <Skeleton className="mt-8 h-6 w-40" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>

      <Skeleton className="mt-10 h-6 w-44" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
