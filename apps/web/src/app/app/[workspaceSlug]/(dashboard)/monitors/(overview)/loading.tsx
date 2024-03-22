import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbarSkeleton } from "@/components/data-table/data-table-toolbar-skeleton";

export default function Loading() {
  return (
    <div className="space-y-4">
      <DataTableToolbarSkeleton />
      <DataTableSkeleton />
    </div>
  );
}
