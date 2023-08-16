import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonForm() {
  return (
    <div className="grid w-full grid-cols-1 items-center space-y-6 sm:grid-cols-6">
      <div className="space-y-2 sm:col-span-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="space-y-2 sm:col-span-5">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="space-y-2 sm:col-span-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="space-y-2 sm:col-span-full">
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}
