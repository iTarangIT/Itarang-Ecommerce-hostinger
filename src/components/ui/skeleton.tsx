import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

/** Matches ProductCard's real layout so nothing shifts when content arrives. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="flex flex-col gap-2 p-4">
        {/* Lead spec, two title lines, price, discount pill, colour row, CTA. */}
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="mt-1 h-6 w-32" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-2 h-11 w-full" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ProductRailSkeleton() {
  return (
    <div className="rail">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="w-[70vw] shrink-0 xs:w-[46vw] sm:w-64 lg:w-72">
          <ProductCardSkeleton />
        </div>
      ))}
    </div>
  );
}
