import { Separator, Skeleton } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";

export default function Loading() {
  return (
    <div className="relative flex w-full flex-col gap-6">
      <Shell className="flex items-center justify-between gap-2">
        <div className="grid gap-2">
          <Skeleton className="h-6 w-24 md:w-40" />
          <Skeleton className="h-4 w-32 md:w-60" />
        </div>
        <div>
          <Skeleton className="h-10 w-[150px]" />
        </div>
      </Shell>
      <Shell className="grid gap-4">
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5 md:gap-6">
            {new Array(4).fill(0).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-5 md:gap-6">
              {new Array(5).fill(0).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex w-full gap-2 sm:flex-row sm:justify-between">
            <Skeleton className="h-10 w-[150px]" />
            <Skeleton className="h-10 w-[150px]" />
          </div>
          <div className="flex gap-2">
            <div className="grid gap-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-[150px]" />
            </div>
            <div className="grid gap-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-[150px]" />
            </div>
          </div>
        </div>
        <Skeleton className="h-[396px] w-full" />
      </Shell>
    </div>
  );
}
