"use client";

import { useQuery } from "@tanstack/react-query";

import { IncidentRow } from "@/components/incidents/incident-row";
import { MaintenanceWindowRow } from "@/components/maintenance-windows/maintenance-window-row";
import { MaintenanceRow } from "@/components/maintenances/maintenance-row";
import { MonitorIncidentRow } from "@/components/monitor-incidents/monitor-incident-row";
import { StatusReportRow } from "@/components/status-reports/status-report-row";
import type { OverviewEvent } from "@/data/overview-events.client";
import { useTRPC } from "@/lib/trpc/client";

/** The feature row for an event, labelled by kind since the list mixes them. */
export function OverviewEventRow({ event }: { event: OverviewEvent }) {
  switch (event.type) {
    case "incident":
      return <MonitorIncidentRow kind incident={event.incident} />;
    case "managedIncident":
      return <IncidentRow kind incident={event.incident} />;
    case "report":
      return <StatusReportRow kind report={event.report} />;
    case "maintenance":
      return <MaintenanceRow kind maintenance={event.maintenance} />;
    case "maintenanceWindow":
      return <WindowRow window={event.window} />;
  }
}

function WindowRow({
  window,
}: {
  window: Extract<OverviewEvent, { type: "maintenanceWindow" }>["window"];
}) {
  const trpc = useTRPC();
  // prefetched by the dashboard layout; the edit sheet picks from these
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  return (
    <MaintenanceWindowRow
      kind
      window={window}
      monitors={(monitors ?? []).map((m) => ({
        id: m.id,
        name: m.name,
        url: m.url,
      }))}
    />
  );
}
