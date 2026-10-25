import type { RouterOutputs } from "@openstatus/api";
import {
  CloudOff,
  Monitor,
  type IconType,
  Report,
  StatusPage,
  Incident as IncidentIcon,
  Maintenance as MaintenanceIcon,
} from "@openstatus/icons";

import type { StatusVariant } from "@/components/common/status-dot";
import { incidentEndedAt } from "@/data/managed-incidents.client";
import { getMonitorHealth } from "@/data/monitors.client";
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

export type OverviewMetric = {
  title: string;
  value: number;
  /** Mono aside after the value: "12 up · 1 down". */
  detail?: string;
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
    endedIncidents,
  }: {
    monitors: RouterOutputs["monitor"]["list"];
    pages: RouterOutputs["page"]["list"];
    monitorIncidents: MonitorIncident[];
    // replaces the downtime count; undefined while loading or on a failed query
    managedIncidents?: RouterOutputs["incident"]["list"];
    // resolved/canceled managed incidents — feed Recent Activity
    endedIncidents?: RouterOutputs["incident"]["list"];
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
    ...[...(managedIncidents ?? []), ...(endedIncidents ?? [])].map(
      (incident) => ({ type: "managedIncident" as const, incident }),
    ),
    ...statusReports.map((report) => ({ type: "report" as const, report })),
    ...maintenances.map((maintenance) => ({
      type: "maintenance" as const,
      maintenance,
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

  const openIncidentsCount = managedIncidents
    ? managedIncidents.length
    : monitorIncidents.filter((i) => !i.resolvedAt).length;
  const openReports = statusReports.filter((r) => r.status !== "resolved");
  const activeMaintenances = maintenances.filter((m) => m.to >= now);
  const runningMaintenances = activeMaintenances.filter((m) => m.from <= now);
  const pagesWithReport = pages.filter((p) => p.hasActiveStatusReport).length;
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const incidentsIn30d = managedIncidents
    ? [...managedIncidents, ...(endedIncidents ?? [])].filter(
        (i) => i.declaredAt >= thirtyDaysAgo,
      ).length
    : monitorIncidents.filter((i) => i.startedAt >= thirtyDaysAgo).length;
  const reportsIn30d = statusReports.filter(
    (r) => reportStartedAt(r) >= thirtyDaysAgo,
  ).length;

  const metrics: OverviewMetric[] = [
    {
      title: "Monitors",
      value: monitors.length,
      detail: monitorHealthDetail(monitors),
      href: "/monitors",
      variant: "default",
      icon: Monitor,
    },
    {
      title: "Status pages",
      value: pages.length,
      detail:
        pages.length === 0
          ? undefined
          : pagesWithReport === 0
            ? "all operational"
            : `${pagesWithReport} with open report`,
      href: "/status-pages",
      variant: "default",
      icon: StatusPage,
    },
    {
      title: "Open incidents",
      value: openIncidentsCount,
      detail: `${incidentsIn30d} in 30d`,
      href: managedIncidents ? "/incidents" : undefined,
      variant: openIncidentsCount > 0 ? "destructive" : "default",
      icon: IncidentIcon,
    },
    {
      title: "Open reports",
      value: openReports.length,
      detail: `${reportsIn30d} in 30d`,
      variant: openReports.length > 0 ? "warning" : "default",
      icon: eventTypeConfig.report.icon,
    },
    {
      title: "Maintenances",
      value: activeMaintenances.length,
      detail: joinDetail([
        [runningMaintenances.length, "running"],
        [activeMaintenances.length - runningMaintenances.length, "upcoming"],
      ]),
      variant: activeMaintenances.length > 0 ? "info" : "default",
      icon: eventTypeConfig.maintenance.icon,
    },
  ];

  return {
    needsAttention,
    upcomingMaintenances,
    recentlyResolved,
    allResolved,
    metrics,
  };
}

/** "12 up · 1 down · 2 paused"; zero counts drop out. */
function monitorHealthDetail(monitors: RouterOutputs["monitor"]["list"]) {
  const counts = { active: 0, degraded: 0, error: 0, inactive: 0 };
  for (const monitor of monitors) counts[getMonitorHealth(monitor)] += 1;
  return joinDetail([
    [counts.active, "up"],
    [counts.degraded, "degraded"],
    [counts.error, "down"],
    [counts.inactive, "paused"],
  ]);
}

function joinDetail(parts: [number, string][]): string | undefined {
  const text = parts
    .filter(([count]) => count > 0)
    .map(([count, label]) => `${count} ${label}`)
    .join(" · ");
  return text || undefined;
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
