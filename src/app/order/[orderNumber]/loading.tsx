import { Skeleton } from '@/components/ui/skeleton';

/**
 * `/order/[orderNumber]` runs an access check, an order lookup and an event
 * lookup before rendering. A shopper reaching this page has just paid, so a
 * blank screen here is the worst possible moment for one.
 */
export default function OrderLoading() {
  return (
    <div className="container py-6 lg:py-10">
      <Skeleton className="h-4 w-64" />

      <div className="mt-6 rounded-xl border border-border bg-card p-6 sm:p-8">
        <Skeleton className="h-8 w-36 rounded-full" />
        <Skeleton className="mt-4 h-9 w-full max-w-lg" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />

        <div className="mt-6 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))}
        </div>
      </div>

      {/* Confirmed / Packed / Shipped / Delivered */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
