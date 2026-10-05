import type { RouterOutputs } from "@openstatus/api";
import {
  Monitor,
  type IconType,
  Report,
  StatusPage,
  Incident as IncidentIcon,
  Maintenance as MaintenanceIcon,
} from "@openstatus/icons";

import type { StatusVariant } from "@/components/common/status-dot";
import {
  reportResolvedAt,
  reportStartedAt,
} from "@/data/status-reports.client";

type MonitorIncident = RouterOutputs["monitorIncident"]["list"][number];
type StatusReport = RouterOutputs["statusReport"]["list"][number];
type Maintenance = RouterOutputs["maintenance"]["list"][number];

export type OverviewEvent =
  | { type: "incident"; incident: MonitorIncident }
  | { type: "report"; report: StatusReport }
  | { type: "maintenance"; maintenance: Maintenance };

export const eventTypeConfig = {
  incident: { label: "Downtime", icon: IncidentIcon },
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
    label: "In Progress",
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
    case "report":
      return event.report.status !== "resolved";
    case "maintenance":
      return event.maintenance.to >= now;
  }
}

export type OverviewMetric = {
  title: string;
  value: number;
  href?: string;
  variant: "default" | "destructive" | "warning" | "info";
  icon: IconType;
};

export function buildOverviewData(
  {
    monitors,
    pages,
    monitorIncidents,
    statusReports,
    maintenances,
    managedIncidents,
  }: {
    monitors: RouterOutputs["monitor"]["list"];
    pages: RouterOutputs["page"]["list"];
    monitorIncidents: MonitorIncident[];
    // set when incident management is enabled — replaces the downtime count
    managedIncidents?: RouterOutputs["incident"]["list"];
    statusReports: StatusReport[];
    maintenances: Maintenance[];
  },
  now = new Date(),
) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const events: OverviewEvent[] = [
    ...monitorIncidents.map((incident) => ({
      type: "incident" as const,
      incident,
    })),
    ...statusReports.map((report) => ({ type: "report" as const, report })),
    ...maintenances.map((maintenance) => ({
      type: "maintenance" as const,
      maintenance,
    })),
  ];

  const needsAttention = events.filter(
    (event) => event.type !== "maintenance" && isOpen(event, now),
  );
  // calendar, not triage — scheduled/in-progress maintenance gets its own section
  const upcomingMaintenances = events.filter(
    (event) => event.type === "maintenance" && isOpen(event, now),
  );
  const recentlyResolved = events.filter((event) => {
    if (isOpen(event, now)) return false;
    const resolvedAt = getResolvedAt(event);
    return resolvedAt !== null && resolvedAt >= sevenDaysAgo;
  });

  const openIncidentsCount = managedIncidents
    ? managedIncidents.length
    : monitorIncidents.filter((i) => !i.resolvedAt).length;
  const openReports = statusReports.filter((r) => r.status !== "resolved");
  const activeMaintenances = maintenances.filter((m) => m.to >= now);

  const metrics: OverviewMetric[] = [
    {
      title: "Monitors",
      value: monitors.length,
      href: "/monitors",
      variant: "default",
      icon: Monitor,
    },
    {
      title: "Status Pages",
      value: pages.length,
      href: "/status-pages",
      variant: "default",
      icon: StatusPage,
    },
    {
      title: "Open Incidents",
      value: openIncidentsCount,
      href: managedIncidents ? "/incidents" : undefined,
      variant: openIncidentsCount > 0 ? "destructive" : "default",
      icon: eventTypeConfig.incident.icon,
    },
    {
      title: "Open Reports",
      value: openReports.length,
      variant: openReports.length > 0 ? "warning" : "default",
      icon: eventTypeConfig.report.icon,
    },
    {
      title: "Scheduled Maintenances",
      value: activeMaintenances.length,
      variant: activeMaintenances.length > 0 ? "info" : "default",
      icon: eventTypeConfig.maintenance.icon,
    },
  ];

  return {
    needsAttention,
    upcomingMaintenances,
    recentlyResolved,
    metrics,
  };
}
