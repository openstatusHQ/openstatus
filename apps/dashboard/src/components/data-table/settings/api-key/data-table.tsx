import type { RouterOutputs } from "@openstatus/api";

import { DataTable as DataTableBase } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";

import { columns } from "./columns";

type ApiKey = RouterOutputs["apiKey"]["list"][number];

export function DataTable({ apiKeys }: { apiKeys: ApiKey[] }) {
  return (
    <DataTableBase
      columns={columns}
      data={apiKeys}
      paginationComponent={DataTablePaginationSimple}
    />
  );
}
