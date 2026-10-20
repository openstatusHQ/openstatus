import { useQuery } from "@tanstack/react-query";

import { DataTable as DataTableBase } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

import { columns } from "./columns";

export function DataTable() {
  const trpc = useTRPC();
  const { data: members } = useQuery(trpc.member.list.queryOptions());

  if (!members) return null;

  return (
    <DataTableBase
      columns={columns}
      data={members}
      paginationComponent={DataTablePaginationSimple}
    />
  );
}
