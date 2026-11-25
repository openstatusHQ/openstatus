import { and, db as defaultDb, eq, gte, inArray, lte } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  pageComponent,
  statusReport,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

export type PageStatus = "operational" | "degraded" | "maintenance";

export type PageOverallStatus = {
  status: PageStatus;
  components: { id: number; status: PageStatus }[];
};

const ACTIVE_REPORT_STATUSES = [
  "investigating",
  "identified",
  "monitoring",
] as const;

/**
 * An active status report degrades the page and the components it names;
 * otherwise a maintenance in progress puts them in maintenance. Gating is the
 * caller's job, as for `getStatusPageContent`.
 */
export async function getPageOverallStatus(args: {
  ctx?: { db?: DB };
  pageId: number;
  /** Component ids of the page, when the caller already loaded them. */
  componentIds?: number[];
}): Promise<PageOverallStatus> {
  const db = args.ctx?.db ?? defaultDb;
  const { pageId } = args;
  const now = new Date();

  const componentIds =
    args.componentIds ??
    (
      await db
        .select({ id: pageComponent.id })
        .from(pageComponent)
        .where(eq(pageComponent.pageId, pageId))
        .orderBy(pageComponent.order, pageComponent.id)
        .all()
    ).map((c) => c.id);

  const [reportRows, pageReports, activeMaintenances] = await Promise.all([
    componentIds.length > 0
      ? db
          .select({
            componentId: statusReportsToPageComponents.pageComponentId,
          })
          .from(statusReportsToPageComponents)
          .innerJoin(
            statusReport,
            eq(statusReportsToPageComponents.statusReportId, statusReport.id),
          )
          .where(
            and(
              inArray(
                statusReportsToPageComponents.pageComponentId,
                componentIds,
              ),
              inArray(statusReport.status, [...ACTIVE_REPORT_STATUSES]),
            ),
          )
          .all()
      : Promise.resolve([]),
    // A report may cover the whole page without naming components.
    db
      .select({ id: statusReport.id })
      .from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, pageId),
          inArray(statusReport.status, [...ACTIVE_REPORT_STATUSES]),
        ),
      )
      .limit(1)
      .all(),
    db
      .select({ id: maintenance.id })
      .from(maintenance)
      .where(
        and(
          eq(maintenance.pageId, pageId),
          lte(maintenance.from, now),
          gte(maintenance.to, now),
        ),
      )
      .all(),
  ]);

  const maintenanceRows =
    activeMaintenances.length > 0
      ? await db
          .select({
            componentId: maintenancesToPageComponents.pageComponentId,
          })
          .from(maintenancesToPageComponents)
          .where(
            inArray(
              maintenancesToPageComponents.maintenanceId,
              activeMaintenances.map((m) => m.id),
            ),
          )
          .all()
      : [];

  const degraded = new Set(reportRows.map((r) => r.componentId));
  const inMaintenance = new Set(maintenanceRows.map((r) => r.componentId));

  return {
    status:
      reportRows.length > 0 || pageReports.length > 0
        ? "degraded"
        : activeMaintenances.length > 0
          ? "maintenance"
          : "operational",
    components: componentIds.map((id) => ({
      id,
      status: degraded.has(id)
        ? "degraded"
        : inMaintenance.has(id)
          ? "maintenance"
          : "operational",
    })),
  };
}
