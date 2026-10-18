"use client";

import { DowntimeRow } from "@/components/downtime/downtime-row";
import { IncidentRow } from "@/components/incidents/incident-row";
import { MaintenanceRow } from "@/components/maintenances/maintenance-row";
import { StatusReportRow } from "@/components/status-reports/status-report-row";
import type { OverviewEvent } from "@/data/overview-events.client";

export function OverviewEventRow({ event }: { event: OverviewEvent }) {
  switch (event.type) {
    case "incident":
      return <DowntimeRow downtime={event.incident} monitor />;
    case "managedIncident":
      return <IncidentRow incident={event.incident} type />;
    case "report":
      return <StatusReportRow report={event.report} type />;
    case "maintenance":
      return <MaintenanceRow maintenance={event.maintenance} type />;
  }
}

export function overviewEventKey(event: OverviewEvent) {
  switch (event.type) {
    case "incident":
    case "managedIncident":
      return `${event.type}-${event.incident.id}`;
    case "report":
      return `report-${event.report.id}`;
    case "maintenance":
      return `maintenance-${event.maintenance.id}`;
  }
}
