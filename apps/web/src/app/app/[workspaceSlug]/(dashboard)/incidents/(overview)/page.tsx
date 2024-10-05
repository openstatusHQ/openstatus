import * as React from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { columns } from "@/components/data-table/incident/columns";
import { DataTable } from "@/components/data-table/incident/data-table";
import { api } from "@/trpc/server";
import { ReportInfoBanner } from "./report-info-banner";

export default async function IncidentPage() {
  const [incidents, statusReports] = await Promise.all([
    api.incident.getIncidentsByWorkspace.query(),
    api.statusReport.getStatusReportByWorkspace.query(),
  ]);

  if (incidents?.length === 0)
    return (
      <>
        <EmptyState
          icon="siren"
          title="No incidents"
          description="Hopefully you will see this screen for a long time."
          action={undefined}
        />
        {!statusReports.length ? <ReportInfoBanner /> : null}
      </>
    );

  return (
    <>
      <DataTable columns={columns} data={incidents} />
      {!statusReports.length ? <ReportInfoBanner /> : null}
    </>
  );
}
