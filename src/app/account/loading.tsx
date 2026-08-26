import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/account` runs three serial awaits — session, order history, then
 * recommendations. This covers the whole of that, rather than only the inner
 * `Suspense` boundary in the page, which cannot help because its fallback is
 * unreachable: `bestSellers()` is awaited while building the child element, so
 * the parent suspends before the boundary mounts.
 */
export default function AccountLoading() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-6 sm:py-8">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-3 h-9 w-56" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
      </div>

      <div className="container py-8 lg:py-10">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>

        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </>
  );
}
