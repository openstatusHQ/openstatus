"use client";

import { IncidentRow } from "@/components/incidents/incident-row";
import { MaintenanceRow } from "@/components/maintenances/maintenance-row";
import { MonitorIncidentRow } from "@/components/monitor-incidents/monitor-incident-row";
import { StatusReportRow } from "@/components/status-reports/status-report-row";
import type { OverviewEvent } from "@/data/overview-events.client";

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
  }
}
