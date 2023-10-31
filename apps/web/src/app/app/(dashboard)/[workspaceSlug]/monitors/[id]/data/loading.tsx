import { Skeleton } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6 md:gap-8">
      <Header.Skeleton>
        <Skeleton className="h-9 w-32" />
      </Header.Skeleton>
      <Skeleton className="h-[396px] w-full" />
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-16" />
        </div>
        <DataTableSkeleton rows={7} />
      </div>
    </div>
  );
}
