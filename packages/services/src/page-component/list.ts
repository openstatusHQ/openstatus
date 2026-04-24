import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  inArray,
  isNull,
} from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  monitor,
  pageComponent,
  pageComponentGroup,
  selectMaintenanceSchema,
  selectMonitorSchema,
  selectPageComponentGroupSchema,
  selectPageComponentSchema,
  selectStatusReportSchema,
  statusReport,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type {
  Maintenance,
  Monitor,
  PageComponent,
  StatusReport,
} from "../types";
import { ListPageComponentsInput } from "./schemas";

type PageComponentGroupRow = typeof pageComponentGroup.$inferSelect;

export type PageComponentWithRelations = PageComponent & {
  monitor?: Monitor | null;
  group?: PageComponentGroupRow | null;
  statusReports: StatusReport[];
  maintenances: Maintenance[];
};

/**
 * Batched enrichment for a list of page components. Four IN queries total
 * (monitors / groups / status reports via join / maintenances via join);
 * no per-row fan-out.
 */
async function enrichPageComponentsBatch(
  db: DB,
  rows: Array<typeof pageComponent.$inferSelect>,
  workspaceId: number,
): Promise<PageComponentWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const monitorIds = Array.from(
    new Set(rows.map((r) => r.monitorId).filter((m): m is number => m != null)),
  );
  const groupIds = Array.from(
    new Set(rows.map((r) => r.groupId).filter((g): g is number => g != null)),
  );

  const [monitorRows, groupRows, statusReportRows, maintenanceRows] =
    await Promise.all([
      monitorIds.length > 0
        ? db
            .select()
            .from(monitor)
            .where(
              and(
                inArray(monitor.id, monitorIds),
                eq(monitor.workspaceId, workspaceId),
                // Skip soft-deleted monitors so the enrichment map
                // doesn't resurrect tombstoned rows as `component.monitor`.
                isNull(monitor.deletedAt),
              ),
            )
            .all()
        : Promise.resolve([] as never[]),
      groupIds.length > 0
        ? db
            .select()
            .from(pageComponentGroup)
            .where(
              and(
                inArray(pageComponentGroup.id, groupIds),
                eq(pageComponentGroup.workspaceId, workspaceId),
              ),
            )
            .all()
        : Promise.resolve([] as never[]),
      // Explicit column selection on join queries — keeps the row shape
      // in our hands instead of relying on drizzle's auto-derived
      // `row.<table_name>` keys (named after the JS variable, fragile to
      // schema renames).
      db
        .select({
          pageComponentId: statusReportsToPageComponents.pageComponentId,
          report: statusReport,
        })
        .from(statusReport)
        .innerJoin(
          statusReportsToPageComponents,
          eq(statusReportsToPageComponents.statusReportId, statusReport.id),
        )
        .where(
          and(
            inArray(statusReportsToPageComponents.pageComponentId, ids),
            eq(statusReport.workspaceId, workspaceId),
          ),
        )
        .all(),
      db
        .select({
          pageComponentId: maintenancesToPageComponents.pageComponentId,
          maintenance,
        })
        .from(maintenance)
        .innerJoin(
          maintenancesToPageComponents,
          eq(maintenancesToPageComponents.maintenanceId, maintenance.id),
        )
        .where(
          and(
            inArray(maintenancesToPageComponents.pageComponentId, ids),
            eq(maintenance.workspaceId, workspaceId),
          ),
        )
        .all(),
    ]);

  const monitorById = new Map<number, Monitor>();
  for (const m of monitorRows) {
    monitorById.set(m.id, selectMonitorSchema.parse(m));
  }

  const groupById = new Map<number, PageComponentGroupRow>();
  for (const g of groupRows) {
    groupById.set(g.id, selectPageComponentGroupSchema.parse(g));
  }

  const statusReportsByComponent = new Map<number, StatusReport[]>();
  for (const row of statusReportRows) {
    const parsed = selectStatusReportSchema.parse(row.report);
    const arr = statusReportsByComponent.get(row.pageComponentId);
    if (arr) arr.push(parsed);
    else statusReportsByComponent.set(row.pageComponentId, [parsed]);
  }

  const maintenancesByComponent = new Map<number, Maintenance[]>();
  for (const row of maintenanceRows) {
    const parsed = selectMaintenanceSchema.parse(row.maintenance);
    const arr = maintenancesByComponent.get(row.pageComponentId);
    if (arr) arr.push(parsed);
    else maintenancesByComponent.set(row.pageComponentId, [parsed]);
  }

  return rows.map((r) => ({
    ...selectPageComponentSchema.parse(r),
    monitor: r.monitorId != null ? monitorById.get(r.monitorId) ?? null : null,
    group: r.groupId != null ? groupById.get(r.groupId) ?? null : null,
    statusReports: statusReportsByComponent.get(r.id) ?? [],
    maintenances: maintenancesByComponent.get(r.id) ?? [],
  }));
}

export async function listPageComponents(args: {
  ctx: ServiceContext;
  input: ListPageComponentsInput;
}): Promise<PageComponentWithRelations[]> {
  const { ctx } = args;
  const input = ListPageComponentsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [eq(pageComponent.workspaceId, ctx.workspace.id)];
  if (input.pageId !== undefined) {
    conditions.push(eq(pageComponent.pageId, input.pageId));
  }

  const rows = await db
    .select()
    .from(pageComponent)
    .where(and(...conditions))
    .orderBy(
      input.order === "desc"
        ? desc(pageComponent.order)
        : asc(pageComponent.order),
    )
    .all();

  return enrichPageComponentsBatch(db, rows, ctx.workspace.id);
}
