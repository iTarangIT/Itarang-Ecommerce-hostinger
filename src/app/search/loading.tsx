import { ProductGridSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function SearchLoading() {
  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container py-5 sm:py-7">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-4 h-10 w-80" />
          <Skeleton className="mt-4 h-12 w-full max-w-xl" />
        </div>
      </div>
      <div className="container grid gap-8 py-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-10">
        <Skeleton className="hidden h-[30rem] w-full lg:block" />
        <ProductGridSkeleton count={9} />
      </div>
    </>
  );
}
