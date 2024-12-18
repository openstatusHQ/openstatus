import Link from "next/link";
import * as React from "react";

import { Button } from "@openstatus/ui/src/components/button";

import { EmptyState } from "@/components/dashboard/empty-state";
import { columns } from "@/components/data-table/status-report/columns";
import { DataTable } from "@/components/data-table/status-report/data-table";
import { api } from "@/trpc/server";

export default async function MonitorPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const reports = await api.statusReport.getStatusReportByPageId.query({
    id: Number.parseInt(params.id),
  });

  if (reports?.length === 0)
    return (
      <EmptyState
        icon="siren"
        title="No status reports"
        description="Create your first status report"
        action={
          <Button asChild>
            <Link href="./reports/new">Create</Link>
          </Button>
        }
      />
    );

  return (
    <div className="space-y-3">
      <Button size="sm" asChild>
        <Link href="./reports/new">Create Status Report</Link>
      </Button>
      <DataTable columns={columns} data={reports} />
    </div>
  );
}
