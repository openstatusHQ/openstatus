"use client";

import { DowntimeEventRow } from "@/components/downtime/downtime-event-row";
import { IncidentEventRow } from "@/components/incidents/incident-event-row";
import { MaintenanceEventRow } from "@/components/maintenances/maintenance-event-row";
import { StatusReportEventRow } from "@/components/status-reports/status-report-event-row";
import type { OverviewEvent } from "@/data/overview-events.client";

export function OverviewEventRow({ event }: { event: OverviewEvent }) {
  switch (event.type) {
    case "incident":
      return <DowntimeEventRow downtime={event.incident} monitor />;
    case "managedIncident":
      return <IncidentEventRow incident={event.incident} type />;
    case "report":
      return <StatusReportEventRow report={event.report} type />;
    case "maintenance":
      return <MaintenanceEventRow maintenance={event.maintenance} type />;
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
