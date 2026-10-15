import { and, eq, gte, isNull, lte, ne, sql } from "@openstatus/db";
import { db } from "@openstatus/db";
import {
  incidentTable,
  maintenance,
  page,
  pageComponent,
  pageConfigurationSchema,
  statusReport,
} from "@openstatus/db/src/schema";
import {
  activeReportStatus,
  getEvents,
} from "@openstatus/services/status-timeline";

export type MonitorStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance"
  | "unknown";

export function parseMonitorId(id: string): number | null {
  if (!/^\d+$/.test(id)) return null;
  const num = Number(id);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
}

export function resolveMonitorStatus(status?: string): MonitorStatus {
  switch (status) {
    case "success":
    case "active":
    case "operational":
      return "operational";
    case "degraded":
    case "degraded_performance":
      return "degraded_performance";
    case "partial_outage":
      return "partial_outage";
    case "error":
    case "major_outage":
      return "major_outage";
    case "info":
    case "under_maintenance":
      return "under_maintenance";
    default:
      return "unknown";
  }
}

export const BADGE_SIZE: Record<
  string,
  {
    width: number;
    height: number;
    padding: number;
    gap: number;
    radius: number;
    fontSize: number;
    textSize: string;
  }
> = {
  sm: {
    width: 120,
    height: 34,
    padding: 8,
    gap: 12,
    radius: 4,
    fontSize: 12,
    textSize: "text-sm",
  },
  md: {
    width: 160,
    height: 46,
    padding: 8,
    gap: 12,
    radius: 4,
    fontSize: 14,
    textSize: "text-base",
  },
  lg: {
    width: 200,
    height: 56,
    padding: 12,
    gap: 16,
    radius: 6,
    fontSize: 16,
    textSize: "text-lg",
  },
  xl: {
    width: 240,
    height: 68,
    padding: 12,
    gap: 16,
    radius: 6,
    fontSize: 18,
    textSize: "text-xl",
  },
};

export function resolveBadgeSize(size: string | null) {
  if (size && Object.hasOwn(BADGE_SIZE, size)) {
    return BADGE_SIZE[size];
  }
  return BADGE_SIZE.sm;
}

export const svgStatusDictionary: Record<
  MonitorStatus,
  { label: string; hexColor: string }
> = {
  operational: { label: "Operational", hexColor: "#10b981" },
  degraded_performance: { label: "Degraded", hexColor: "#f59e0b" },
  partial_outage: { label: "Partial Outage", hexColor: "#f59e0b" },
  major_outage: { label: "Outage", hexColor: "#ef4444" },
  under_maintenance: { label: "Maintenance", hexColor: "#3b82f6" },
  unknown: { label: "Unknown", hexColor: "#6b7280" },
};

export const pngStatusDictionary: Record<
  MonitorStatus,
  { label: string; color: string }
> = {
  operational: { label: "Operational", color: "bg-green-500" },
  degraded_performance: { label: "Degraded", color: "bg-yellow-500" },
  partial_outage: { label: "Partial Outage", color: "bg-yellow-500" },
  major_outage: { label: "Outage", color: "bg-red-500" },
  under_maintenance: { label: "Maintenance", color: "bg-blue-500" },
  unknown: { label: "Unknown", color: "bg-gray-500" },
};

export function getTextWidth(text: string, fontSize: number): number {
  const monoCharWidthRatio = 0.6;
  return text.length * monoCharWidthRatio * fontSize;
}

export async function getPublicMonitorForBadge(
  domain: string,
  monitorId: number,
) {
  const prefix = domain.toLowerCase();
  const pageRow = await db.query.page.findFirst({
    where: sql`lower(${page.slug}) = ${prefix} OR lower(${page.customDomain}) = ${prefix}`,
    columns: {
      id: true,
      slug: true,
      accessType: true,
      configuration: true,
    },
    with: {
      pageComponents: {
        where: eq(pageComponent.monitorId, monitorId),
        with: {
          monitor: {
            with: {
              incidents: {
                where: isNull(incidentTable.resolvedAt),
              },
            },
          },
        },
      },
      maintenances: {
        where: and(
          lte(maintenance.from, new Date()),
          gte(maintenance.to, new Date()),
        ),
        with: {
          maintenancesToPageComponents: {
            with: {
              pageComponent: true,
            },
          },
        },
      },
      statusReports: {
        where: ne(statusReport.status, "resolved"),
        with: {
          statusReportUpdates: {
            orderBy: (reports, { desc }) => desc(reports.date),
            with: { statusReportUpdateToPageComponents: true },
          },
          statusReportsToPageComponents: {
            with: {
              pageComponent: true,
            },
          },
        },
      },
    },
  });

  if (!pageRow || pageRow.accessType !== "public") {
    return null;
  }

  const component = pageRow.pageComponents.find(
    (c) => c.monitorId === monitorId,
  );
  if (
    !component ||
    !component.monitor ||
    !component.monitor.public ||
    component.monitor.deletedAt ||
    !component.monitor.active
  ) {
    return null;
  }

  const events = getEvents({
    maintenances: pageRow.maintenances,
    incidents: component.monitor.incidents ?? [],
    reports: pageRow.statusReports,
    pageComponentId: component.id,
    monitorId: component.monitor.id,
  });

  const parsedConfig = pageConfigurationSchema.safeParse(
    pageRow.configuration ?? {},
  );
  const barType = parsedConfig.success ? parsedConfig.data.type : undefined;

  const status =
    events.some((e) => e.type === "incident" && !e.to) && barType !== "manual"
      ? "error"
      : (activeReportStatus(events) ??
        (events.some(
          (e) =>
            e.type === "maintenance" &&
            e.to &&
            e.from.getTime() <= Date.now() &&
            e.to.getTime() >= Date.now(),
        )
          ? "info"
          : "success"));

  return {
    ...component.monitor,
    status,
  };
}
