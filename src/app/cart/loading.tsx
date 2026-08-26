import { ProductRailSkeleton, Skeleton } from '@/components/ui/skeleton';

/**
 * `/cart` is `force-dynamic` — it waits on a session lookup and a catalogue read
 * before it can render anything. Without this boundary the browser sits on the
 * previous page for the whole round trip with no sign that the click landed.
 *
 * The shape mirrors `CartPageBody`'s populated state, which is what a shopper
 * clicking "Cart" almost always has.
 */
export default function CartLoading() {
  return (
    <div className="container py-6 lg:py-10">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-9 w-48" />
      <Skeleton className="mt-2 h-4 w-56" />

      <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-8">
          <Skeleton className="h-12 w-full rounded-lg" />

          <ul className="mt-4 divide-y divide-border border-y border-border">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex gap-4 py-4">
                <Skeleton className="h-24 w-24 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
                <Skeleton className="h-10 w-28 shrink-0" />
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4">
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-4 h-7 w-40" />
            <Skeleton className="mt-2 h-12 w-full" />
          </div>
        </div>
      </div>

      <section className="mt-10">
        <Skeleton className="h-6 w-48" />
        <div className="mt-4">
          <ProductRailSkeleton />
        </div>
      </section>
    </div>
  );
}
