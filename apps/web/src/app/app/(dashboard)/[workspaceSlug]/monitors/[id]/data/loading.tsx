import { Skeleton } from "@openstatus/ui";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

export default function Loading() {
  return (
    <div className="grid gap-6 md:gap-8">
      <Header.Skeleton />
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-64" />
        </div>
        <DataTableSkeleton rows={7} />
      </div>
    </div>
  );
}
