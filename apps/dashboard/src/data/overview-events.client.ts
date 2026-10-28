import type { RouterOutputs } from "@openstatus/api";
import {
  CloudOff,
  Report,
  Incident as IncidentIcon,
  Maintenance as MaintenanceIcon,
} from "@openstatus/icons";

import type { StatusVariant } from "@/components/common/status-dot";
import { incidentEndedAt } from "@/data/managed-incidents.client";
import {
  reportResolvedAt,
  reportStartedAt,
} from "@/data/status-reports.client";

type MonitorIncident = RouterOutputs["monitorIncident"]["list"][number];
type ManagedIncident = NonNullable<RouterOutputs["incident"]["list"]>[number];
type StatusReport = RouterOutputs["statusReport"]["list"][number];
type Maintenance = RouterOutputs["maintenance"]["list"][number];

export type OverviewEvent =
  | { type: "incident"; incident: MonitorIncident }
  | { type: "managedIncident"; incident: ManagedIncident }
  | { type: "report"; report: StatusReport }
  | { type: "maintenance"; maintenance: Maintenance };

export const eventTypeConfig = {
  incident: { label: "Downtime", icon: CloudOff },
  managedIncident: { label: "Incident", icon: IncidentIcon },
  report: { label: "Status Report", icon: Report },
  maintenance: { label: "Maintenance", icon: MaintenanceIcon },
} as const;

export type OverviewEventType = keyof typeof eventTypeConfig;

export const incidentStatusConfig = {
  ongoing: { label: "Ongoing", color: "text-destructive/80" },
  acknowledged: { label: "Acknowledged", color: "text-warning/80" },
  resolved: { label: "Resolved", color: "text-success/80" },
} as const;

export type IncidentStatus = keyof typeof incidentStatusConfig;

export const maintenanceStatusConfig = {
  scheduled: { label: "Scheduled", color: "text-info/80", variant: "info" },
  "in-progress": {
    label: "In progress",
    color: "text-info/80",
    variant: "warning",
  },
  completed: {
    label: "Completed",
    color: "text-info/80",
    variant: "success",
  },
} as const satisfies Record<
  string,
  { label: string; color: string; variant: StatusVariant }
>;

export type MaintenanceStatus = keyof typeof maintenanceStatusConfig;

export function getIncidentStatus(incident: {
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
}): IncidentStatus {
  if (incident.resolvedAt) return "resolved";
  if (incident.acknowledgedAt) return "acknowledged";
  return "ongoing";
}

export function getMaintenanceStatus(
  maintenance: { from: Date; to: Date },
  now = new Date(),
): MaintenanceStatus {
  if (now < maintenance.from) return "scheduled";
  if (now > maintenance.to) return "completed";
  return "in-progress";
}

export function getStartedAt(event: OverviewEvent): Date {
  switch (event.type) {
    case "incident":
    case "managedIncident":
      return event.incident.startedAt;
    case "report":
      return reportStartedAt(event.report);
    case "maintenance":
      return event.maintenance.from;
  }
}

export function getResolvedAt(event: OverviewEvent): Date | null {
  switch (event.type) {
    case "incident":
      return event.incident.resolvedAt;
    case "managedIncident":
      return incidentEndedAt(event.incident);
    case "report":
      return reportResolvedAt(event.report);
    case "maintenance":
      return event.maintenance.to;
  }
}

function isOpen(event: OverviewEvent, now: Date): boolean {
  switch (event.type) {
    case "incident":
      return !event.incident.resolvedAt;
    case "managedIncident":
      return (
        event.incident.status === "open" ||
        event.incident.status === "mitigated"
      );
    case "report":
      return event.report.status !== "resolved";
    case "maintenance":
      return event.maintenance.to >= now;
  }
}

export function buildOverviewData(
  {
    monitorIncidents,
    statusReports,
    maintenances,
    managedIncidents,
    endedIncidents,
  }: {
    monitorIncidents: MonitorIncident[];
    // open/mitigated; undefined while loading or on a failed query
    managedIncidents?: RouterOutputs["incident"]["list"];
    // resolved/canceled managed incidents — feed Recent Activity
    endedIncidents?: RouterOutputs["incident"]["list"];
    statusReports: StatusReport[];
    maintenances: Maintenance[];
  },
  now = new Date(),
) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // this order lists a calendar day's links: incidents and reports before downtime
  const events: OverviewEvent[] = [
    ...[...(managedIncidents ?? []), ...(endedIncidents ?? [])].map(
      (incident) => ({ type: "managedIncident" as const, incident }),
    ),
    ...statusReports.map((report) => ({ type: "report" as const, report })),
    ...maintenances.map((maintenance) => ({
      type: "maintenance" as const,
      maintenance,
    })),
    ...monitorIncidents.map((incident) => ({
      type: "incident" as const,
      incident,
    })),
  ];

  const byStart = (a: OverviewEvent, b: OverviewEvent) =>
    getStartedAt(b).getTime() - getStartedAt(a).getTime();
  const needsAttention = events
    .filter((event) => event.type !== "maintenance" && isOpen(event, now))
    .sort(byStart);
  // calendar, not triage — scheduled/in-progress maintenance gets its own section
  const upcomingMaintenances = events
    .filter((event) => event.type === "maintenance" && isOpen(event, now))
    .sort((a, b) => byStart(b, a));
  // newest end first; `recentlyResolved` is the head of `allResolved`
  const allResolved = events
    .filter((event) => !isOpen(event, now) && getResolvedAt(event) !== null)
    .sort(
      (a, b) =>
        (getResolvedAt(b)?.getTime() ?? 0) - (getResolvedAt(a)?.getTime() ?? 0),
    );
  const recentlyResolved = allResolved.filter((event) => {
    const resolvedAt = getResolvedAt(event);
    return resolvedAt !== null && resolvedAt >= sevenDaysAgo;
  });

  return {
    events,
    needsAttention,
    upcomingMaintenances,
    recentlyResolved,
    allResolved,
  };
}

export function eventKey(event: OverviewEvent): string {
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
