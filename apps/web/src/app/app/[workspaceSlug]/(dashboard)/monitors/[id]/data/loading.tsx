import { Skeleton } from "@openstatus/ui";

import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4">
      <div className="flex flex-row items-center justify-between">
        <Skeleton className="h-10 w-[150px]" />
        <Skeleton className="h-9 w-9" />
      </div>
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-16" />
        </div>
        <DataTableSkeleton rows={7} />
      </div>
    </div>
  );
}
