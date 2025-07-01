"use client";

import { DataTable } from "@/components/ui/data-table/data-table";
import { columns as statusReportsColumns } from "@/components/data-table/status-reports/columns";
import { DataTable as UpdatesDataTable } from "@/components/data-table/status-report-updates/data-table";
import type { RouterOutputs } from "@openstatus/api";

type StatusReport = RouterOutputs["statusReport"]["list"][number];

export function DataTableStatusReports({
  statusReports,
}: {
  statusReports: StatusReport[];
}) {
  return (
    <DataTable
      columns={statusReportsColumns}
      data={statusReports}
      rowComponent={({ row }) => (
        <UpdatesDataTable
          updates={row.original.updates}
          reportId={row.original.id}
        />
      )}
    />
  );
}
