import { and, db as defaultDb, desc, eq, inArray } from "@openstatus/db";
import {
  type PageComponentImpact,
  maintenance,
  maintenancesToPageComponents,
  pageComponent,
  pageComponentGroup,
  statusReport,
  statusReportUpdate,
  statusReportUpdateToPageComponents,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

type ComponentRow = typeof pageComponent.$inferSelect;
type GroupRow = typeof pageComponentGroup.$inferSelect;
type ReportRow = typeof statusReport.$inferSelect;
type UpdateRow = typeof statusReportUpdate.$inferSelect;
type MaintenanceRow = typeof maintenance.$inferSelect;

export type StatusReportContent = ReportRow & {
  pageComponentIds: number[];
  updates: Array<
    UpdateRow & {
      componentImpacts: {
        pageComponentId: number;
        impact: PageComponentImpact;
      }[];
    }
  >;
};

export type MaintenanceContent = MaintenanceRow & {
  pageComponentIds: number[];
};

export type StatusPageContent = {
  components: ComponentRow[];
  groups: GroupRow[];
  statusReports: StatusReportContent[];
  maintenances: MaintenanceContent[];
};

const ACTIVE_REPORT_STATUSES = [
  "investigating",
  "identified",
  "monitoring",
] as const;

/**
 * Shared read for a status page's renderable content (components, groups,
 * active reports with per-update impacts, maintenances), transport-agnostic so
 * both the Connect handlers and the tRPC router can consume it. Uses `ctx.db`
 * so callers can run it inside a transaction.
 */
export async function getStatusPageContent(args: {
  ctx?: { db?: DB };
  pageId: number;
}): Promise<StatusPageContent> {
  const db = args.ctx?.db ?? defaultDb;
  const { pageId } = args;

  const [components, groups, activeReports, pageMaintenances] =
    await Promise.all([
      db
        .select()
        .from(pageComponent)
        .where(eq(pageComponent.pageId, pageId))
        .orderBy(pageComponent.order)
        .all(),
      db
        .select()
        .from(pageComponentGroup)
        .where(eq(pageComponentGroup.pageId, pageId))
        .all(),
      db
        .select()
        .from(statusReport)
        .where(
          and(
            eq(statusReport.pageId, pageId),
            inArray(statusReport.status, [...ACTIVE_REPORT_STATUSES]),
          ),
        )
        .orderBy(desc(statusReport.createdAt))
        .all(),
      db
        .select()
        .from(maintenance)
        .where(eq(maintenance.pageId, pageId))
        .orderBy(desc(maintenance.from))
        .all(),
    ]);

  const reportIds = activeReports.map((r) => r.id);
  const [reportUpdates, reportComponents] = await Promise.all([
    reportIds.length > 0
      ? db
          .select()
          .from(statusReportUpdate)
          .where(inArray(statusReportUpdate.statusReportId, reportIds))
          .orderBy(desc(statusReportUpdate.date))
          .all()
      : Promise.resolve([] as UpdateRow[]),
    reportIds.length > 0
      ? db
          .select()
          .from(statusReportsToPageComponents)
          .where(
            inArray(statusReportsToPageComponents.statusReportId, reportIds),
          )
          .all()
      : Promise.resolve(
          [] as (typeof statusReportsToPageComponents.$inferSelect)[],
        ),
  ]);

  const updateIds = reportUpdates.map((u) => u.id);
  const updateImpacts =
    updateIds.length > 0
      ? await db
          .select()
          .from(statusReportUpdateToPageComponents)
          .where(
            inArray(
              statusReportUpdateToPageComponents.statusReportUpdateId,
              updateIds,
            ),
          )
          .all()
      : [];

  const impactsByUpdate = new Map<number, typeof updateImpacts>();
  for (const row of updateImpacts) {
    const arr = impactsByUpdate.get(row.statusReportUpdateId);
    if (arr) arr.push(row);
    else impactsByUpdate.set(row.statusReportUpdateId, [row]);
  }

  const statusReports: StatusReportContent[] = activeReports.map((report) => ({
    ...report,
    pageComponentIds: reportComponents
      .filter((rc) => rc.statusReportId === report.id)
      .map((rc) => rc.pageComponentId),
    updates: reportUpdates
      .filter((u) => u.statusReportId === report.id)
      .map((u) => ({
        ...u,
        componentImpacts: (impactsByUpdate.get(u.id) ?? []).map((row) => ({
          pageComponentId: row.pageComponentId,
          impact: row.impact,
        })),
      })),
  }));

  const maintenanceIds = pageMaintenances.map((m) => m.id);
  const maintenanceComponents =
    maintenanceIds.length > 0
      ? await db
          .select()
          .from(maintenancesToPageComponents)
          .where(
            inArray(maintenancesToPageComponents.maintenanceId, maintenanceIds),
          )
          .all()
      : [];

  const maintenances: MaintenanceContent[] = pageMaintenances.map((m) => ({
    ...m,
    pageComponentIds: maintenanceComponents
      .filter((mc) => mc.maintenanceId === m.id)
      .map((mc) => mc.pageComponentId),
  }));

  return { components, groups, statusReports, maintenances };
}
