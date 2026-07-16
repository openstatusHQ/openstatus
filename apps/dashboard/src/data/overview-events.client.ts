import type { RouterOutputs } from "@openstatus/api";
import {
  Activity,
  type LucideIcon,
  Megaphone,
  PanelTop,
  Siren,
  Wrench,
} from "lucide-react";

type Incident = RouterOutputs["incident"]["list"][number];
type StatusReport = RouterOutputs["statusReport"]["list"][number];
type Maintenance = RouterOutputs["maintenance"]["list"][number];

export type OverviewEvent =
  | { type: "incident"; incident: Incident }
  | { type: "report"; report: StatusReport }
  | { type: "maintenance"; maintenance: Maintenance };

export const eventTypeConfig = {
  incident: { label: "Incident", icon: Siren },
  report: { label: "Status Report", icon: Megaphone },
  maintenance: { label: "Maintenance", icon: Wrench },
} as const;

export type OverviewEventType = keyof typeof eventTypeConfig;

export const incidentStatusConfig = {
  ongoing: { label: "Ongoing", color: "text-destructive/80" },
  acknowledged: { label: "Acknowledged", color: "text-warning/80" },
  resolved: { label: "Resolved", color: "text-success/80" },
} as const;

export type IncidentStatus = keyof typeof incidentStatusConfig;

export const maintenanceStatusConfig = {
  scheduled: { label: "Scheduled", color: "text-info/80" },
  "in-progress": { label: "In Progress", color: "text-info/80" },
  completed: { label: "Completed", color: "text-info/80" },
} as const;

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

function reportStartedAt(report: StatusReport): Date {
  const dates = report.updates.map((u) => u.date.getTime());
  if (dates.length) return new Date(Math.min(...dates));
  return report.createdAt ?? new Date(0);
}

function reportResolvedAt(report: StatusReport): Date | null {
  if (report.status !== "resolved") return null;
  const dates = report.updates.map((u) => u.date.getTime());
  // legacy resolved report without updates: fall back to updatedAt
  if (!dates.length) return report.updatedAt ?? report.createdAt;
  return new Date(Math.max(...dates));
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
  icon: LucideIcon;
};

export function buildOverviewData(
  {
    monitors,
    pages,
    incidents,
    statusReports,
    maintenances,
  }: {
    monitors: RouterOutputs["monitor"]["list"];
    pages: RouterOutputs["page"]["list"];
    incidents: Incident[];
    statusReports: StatusReport[];
    maintenances: Maintenance[];
  },
  now = new Date(),
) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const events: OverviewEvent[] = [
    ...incidents.map((incident) => ({ type: "incident" as const, incident })),
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

  const openIncidents = incidents.filter((i) => !i.resolvedAt);
  const openReports = statusReports.filter((r) => r.status !== "resolved");
  const activeMaintenances = maintenances.filter((m) => m.to >= now);

  const metrics: OverviewMetric[] = [
    {
      title: "Monitors",
      value: monitors.length,
      href: "/monitors",
      variant: "default",
      icon: Activity,
    },
    {
      title: "Status Pages",
      value: pages.length,
      href: "/status-pages",
      variant: "default",
      icon: PanelTop,
    },
    {
      title: "Open Incidents",
      value: openIncidents.length,
      variant: openIncidents.length > 0 ? "destructive" : "default",
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
