import { Skeleton } from '@/components/ui/skeleton';

export default function ProductLoading() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-4">
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      <div className="container py-6 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <div className="lg:flex lg:gap-4">
              <div className="hidden w-20 shrink-0 flex-col gap-2 lg:flex">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="aspect-square w-full" />
                ))}
              </div>
              <Skeleton className="aspect-square w-full flex-1 rounded-xl" />
            </div>
          </div>

          <div className="space-y-4 lg:col-span-5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 h-10 w-52" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </>
  );
}
