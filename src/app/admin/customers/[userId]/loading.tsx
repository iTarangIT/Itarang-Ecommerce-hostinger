import { Skeleton } from '@/components/ui/skeleton';

/** One union query over browsing, orders and payments for a single person. */
export default function CustomerActivityLoading() {
  return (
    <div className="container py-8">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-4 h-24 w-full rounded-lg" />

      <Skeleton className="mt-8 h-6 w-24" />
      <div className="mt-3 space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
