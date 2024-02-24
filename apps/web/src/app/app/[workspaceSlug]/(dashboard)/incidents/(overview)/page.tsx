import * as React from "react";

import { EmptyState } from "@/components/dashboard/empty-state";
import { columns } from "@/components/data-table/incident/columns";
import { DataTable } from "@/components/data-table/incident/data-table";
import { api } from "@/trpc/server";

export default async function IncidentPage() {
  const incidents = await api.incident.getIncidentsByWorkspace.query();

  if (incidents?.length === 0)
    return (
      <EmptyState
        icon="activity"
        title="No Incidents"
        description="Hopefully you will see this screen for a long time."
        action={undefined}
      />
    );

  return (
    <>
      <DataTable columns={columns} data={incidents} />
    </>
  );
}
