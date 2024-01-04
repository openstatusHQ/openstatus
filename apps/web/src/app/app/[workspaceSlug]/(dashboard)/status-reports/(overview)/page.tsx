import * as React from "react";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { columns } from "@/components/data-table/status-report/columns";
import { DataTable } from "@/components/data-table/status-report/data-table";
import { api } from "@/trpc/server";

export default async function MonitorPage() {
  const reports = await api.statusReport.getStatusReportByWorkspace.query();

  if (reports?.length === 0)
    return (
      <EmptyState
        icon="siren"
        title="No status reports"
        description="Create your first status report"
        action={
          <Button asChild>
            <Link href="./status-reports/new">Create</Link>
          </Button>
        }
      />
    );

  return <DataTable columns={columns} data={reports} />;
}
