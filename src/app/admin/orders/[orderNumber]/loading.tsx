import { Skeleton } from '@/components/ui/skeleton';

/**
 * The admin order detail runs four queries — order, events, payments and
 * reservations — behind the layout's own `requireAdmin()` lookup.
 */
export default function AdminOrderLoading() {
  return (
    <div className="container py-8">
      <Skeleton className="h-4 w-28" />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="mt-2 h-4 w-56" />

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          {/* Items, amounts, payments, history */}
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card">
              <Skeleton className="h-10 w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6 lg:col-span-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card">
              <Skeleton className="h-10 w-full rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
