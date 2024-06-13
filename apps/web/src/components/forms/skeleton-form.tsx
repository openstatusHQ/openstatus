import { Skeleton } from "@openstatus/ui";

export function SkeletonForm() {
  return (
    <div className="grid w-full gap-6">
      <div className="col-span-full grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid w-full gap-6 sm:col-span-2">
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-5 w-64" />
          </div>
        </div>
      </div>
      <Skeleton className="h-9 w-full" />
      <div className="flex space-y-2 sm:col-span-full sm:justify-end">
        <Skeleton className="h-9 w-full sm:w-28" />
      </div>
    </div>
  );
}
