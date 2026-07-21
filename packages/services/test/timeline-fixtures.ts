import type { PageComponent } from "@openstatus/db/src/schema";

import type { Event, StatusData } from "../src/status-timeline";

// Helper functions to create test data
export function createStatusData(
  daysAgo: number,
  ok = 0,
  degraded = 0,
  error = 0,
): StatusData {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setUTCHours(0, 0, 0, 0);

  return {
    day: date.toISOString(),
    count: ok + degraded + error,
    ok,
    degraded,
    error,
    monitorId: "1",
  };
}

export function createIncident(
  id: number,
  daysAgo: number,
  durationHours = 1,
): Event {
  const from = new Date();
  from.setDate(from.getDate() - daysAgo);
  from.setHours(from.getHours() - durationHours);

  const to = new Date(from);
  to.setHours(to.getHours() + durationHours);

  return {
    id,
    name: "Downtime",
    from,
    to,
    type: "incident",
    status: "error",
  };
}

export function createReport(
  id: number,
  daysAgo: number,
  durationHours = 2,
): Event {
  const from = new Date();
  from.setDate(from.getDate() - daysAgo);
  from.setHours(from.getHours() - durationHours);

  const to = new Date(from);
  to.setHours(to.getHours() + durationHours);

  return {
    id,
    name: "Performance Issues",
    from,
    to,
    type: "report",
    status: "degraded",
  };
}

export function createMaintenance(
  id: number,
  daysAgo: number,
  durationHours = 1,
): Event {
  const from = new Date();
  from.setDate(from.getDate() - daysAgo);
  from.setHours(from.getHours() - durationHours);

  const to = new Date(from);
  to.setHours(to.getHours() + durationHours);

  return {
    id,
    name: "Scheduled Maintenance",
    from,
    to,
    type: "maintenance",
    status: "info",
  };
}

export type Impact =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage";

export function dayStartUTC(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function hoursAfter(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function createImpactEvent(
  id: number,
  from: Date,
  to: Date | null,
  impactIntervals: { from: Date; to: Date | null; impact: Impact }[],
) {
  return {
    id,
    name: `Impact Report ${id}`,
    from,
    to,
    type: "report" as const,
    status: "degraded" as const,
    impactIntervals,
  };
}

export function createLegacyEvent(id: number, from: Date, to: Date | null) {
  return {
    id,
    name: `Legacy Report ${id}`,
    from,
    to,
    type: "report" as const,
    status: "degraded" as const,
  };
}

export function impactComponent(id: number, monitorId?: number): PageComponent {
  return {
    id,
    workspaceId: 1,
    pageId: 1,
    type: monitorId ? ("monitor" as const) : ("static" as const),
    monitorId: monitorId ?? null,
    name: `Component ${id}`,
    description: null,
    order: 0,
    groupId: null,
    groupOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export function createImpactReport(args: {
  id: number;
  status?: "investigating" | "resolved";
  components: number[];
  updates: Array<{
    id: number;
    date: Date;
    status: "investigating" | "identified" | "monitoring" | "resolved";
    impacts?: Array<{ pageComponentId: number; impact: Impact }>;
  }>;
}) {
  return {
    id: args.id,
    title: `Status Report ${args.id}`,
    status: args.status ?? ("investigating" as const),
    workspaceId: 1,
    pageId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    statusReportsToPageComponents: args.components.map((pcId) => ({
      pageComponent: impactComponent(pcId, pcId * 10),
    })),
    statusReportUpdates: args.updates.map((u) => ({
      id: u.id,
      statusReportId: args.id,
      date: u.date,
      status: u.status,
      message: "m",
      createdAt: new Date(),
      updatedAt: new Date(),
      statusReportUpdateToPageComponents: (u.impacts ?? []).map((r) => ({
        pageComponentId: r.pageComponentId,
        impact: r.impact,
      })),
    })),
  };
}
