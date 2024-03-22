import { Skeleton } from "@openstatus/ui";

export function DataTableToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 items-center gap-2">
        <Skeleton className="h-8 w-[150px] lg:w-[250px]" />
      </div>
    </div>
  );
}
