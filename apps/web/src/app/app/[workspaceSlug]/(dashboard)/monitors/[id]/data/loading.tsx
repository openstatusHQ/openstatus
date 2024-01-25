import { Skeleton } from "@openstatus/ui";

import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <div className="grid gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-10 w-[150px]" />
        </div>
      </div>
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-16" />
        </div>
        <DataTableSkeleton rows={7} />
      </div>
    </div>
  );
}
