import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  sql,
} from "@openstatus/db";
import {
  maintenance,
  maintenanceUpdate,
  maintenancesToPageComponents,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
  pageComponent,
  selectPageComponentSchema,
} from "@openstatus/db/src/schema";

import { type AttributedUserDetail, loadAttributedUsers } from "../attribution";
import { requireScope } from "../auth";
import type { DB, ServiceContext } from "../context";
import type { Maintenance, MaintenanceUpdate, PageComponent } from "../types";
import { getMaintenanceInWorkspace } from "./internal";
import {
  GetMaintenanceInput,
  ListMaintenancesInput,
  type MaintenanceListPeriod,
} from "./schemas";
import { latestMaintenanceUpdate } from "./utils";

function periodToSince(period: MaintenanceListPeriod): Date {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  switch (period) {
    case "1d":
      return new Date(now - 1 * day);
    case "7d":
      return new Date(now - 7 * day);
    case "14d":
      return new Date(now - 14 * day);
  }
}

type Attributed = {
  createdByUser: AttributedUserDetail | null;
  updatedByUser: AttributedUserDetail | null;
};

export type MaintenanceUpdateWithRelations = MaintenanceUpdate & Attributed;

export type MaintenanceWithRelations = Maintenance & {
  /** Newest first. `message` on the row is the newest update's text. */
  updates: MaintenanceUpdateWithRelations[];
  pageComponents: PageComponent[];
  pageComponentIds: number[];
  /** Monitors whose checks change during it: the window's when linked, else those behind its components (paused). */
  affectedMonitors: { id: number; name: string }[];
  /** The window it announces; its times and checks follow this window. */
  window: { id: number; title: string; mode: "pause" | "continue" } | null;
  createdByUser: AttributedUserDetail | null;
  updatedByUser: AttributedUserDetail | null;
};

export type ListMaintenancesResult = {
  items: MaintenanceWithRelations[];
  totalSize: number;
};

/**
 * Load component associations for a set of maintenances in a single IN
 * query, regardless of list size. Avoids the 2-queries-per-row pattern
 * that pairs badly with the dashboard's effectively-unlimited list.
 */
async function enrichMaintenancesBatch(
  db: DB,
  rows: Maintenance[],
): Promise<MaintenanceWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const allUpdates = await db
    .select()
    .from(maintenanceUpdate)
    .where(inArray(maintenanceUpdate.maintenanceId, ids))
    .orderBy(desc(maintenanceUpdate.date), desc(maintenanceUpdate.id))
    .all();

  // Explicit column selection (not `select()`) keeps the row shape in our
  // hands instead of relying on drizzle's auto-derived `row.<table_name>`
  // keys, which are named after the JS variable and silently break on
  // schema rename.
  const assocRows = await db
    .select({
      maintenanceId: maintenancesToPageComponents.maintenanceId,
      component: pageComponent,
    })
    .from(pageComponent)
    .innerJoin(
      maintenancesToPageComponents,
      eq(maintenancesToPageComponents.pageComponentId, pageComponent.id),
    )
    .where(inArray(maintenancesToPageComponents.maintenanceId, ids))
    .all();

  const windowIds = [
    ...new Set(
      rows.flatMap((r) =>
        r.monitorMaintenanceWindowId == null
          ? []
          : [r.monitorMaintenanceWindowId],
      ),
    ),
  ];
  const [windowRows, windowLinks] =
    windowIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              id: monitorMaintenanceWindow.id,
              title: monitorMaintenanceWindow.title,
              mode: monitorMaintenanceWindow.mode,
            })
            .from(monitorMaintenanceWindow)
            .where(inArray(monitorMaintenanceWindow.id, windowIds))
            .all(),
          db
            .select({
              windowId:
                monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
              monitorId: monitorMaintenanceWindowToMonitor.monitorId,
            })
            .from(monitorMaintenanceWindowToMonitor)
            .where(
              inArray(
                monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
                windowIds,
              ),
            )
            .all(),
        ]);
  const windowById = new Map(windowRows.map((w) => [w.id, w]));

  const monitorIds = [
    ...new Set([
      ...assocRows.flatMap((r) =>
        r.component.monitorId == null ? [] : [r.component.monitorId],
      ),
      ...windowLinks.map((l) => l.monitorId),
    ]),
  ];
  const monitorRows =
    monitorIds.length === 0
      ? []
      : await db
          .select({ id: monitor.id, name: monitor.name })
          .from(monitor)
          .where(
            and(inArray(monitor.id, monitorIds), isNull(monitor.deletedAt)),
          )
          .all();
  const monitorById = new Map(monitorRows.map((m) => [m.id, m]));

  const users = await loadAttributedUsers(db, [
    ...rows.flatMap((r) => [r.createdBy, r.updatedBy]),
    ...allUpdates.flatMap((u) => [u.createdBy, u.updatedBy]),
  ]);
  const attributed = (row: {
    createdBy: number | null;
    updatedBy: number | null;
  }): Attributed => ({
    createdByUser:
      row.createdBy != null ? (users.get(row.createdBy) ?? null) : null,
    updatedByUser:
      row.updatedBy != null ? (users.get(row.updatedBy) ?? null) : null,
  });

  const updatesByMaintenance = new Map<
    number,
    MaintenanceUpdateWithRelations[]
  >();
  for (const update of allUpdates) {
    const withUsers = { ...update, ...attributed(update) };
    const existing = updatesByMaintenance.get(update.maintenanceId);
    if (existing) existing.push(withUsers);
    else updatesByMaintenance.set(update.maintenanceId, [withUsers]);
  }

  const componentsByMaintenance = new Map<number, PageComponent[]>();
  for (const row of assocRows) {
    const component = selectPageComponentSchema.parse(row.component);
    const arr = componentsByMaintenance.get(row.maintenanceId);
    if (arr) arr.push(component);
    else componentsByMaintenance.set(row.maintenanceId, [component]);
  }

  return rows.map((r) => {
    const components = componentsByMaintenance.get(r.id) ?? [];
    const updates = updatesByMaintenance.get(r.id) ?? [];
    return {
      ...r,
      // the column is a stale mirror of the first update
      message: latestMaintenanceUpdate(updates)?.message ?? r.message,
      updates,
      pageComponents: components,
      pageComponentIds: components.map((c) => c.id),
      window:
        r.monitorMaintenanceWindowId == null
          ? null
          : (windowById.get(r.monitorMaintenanceWindowId) ?? null),
      affectedMonitors: [
        ...new Map(
          (r.monitorMaintenanceWindowId != null
            ? windowLinks
                .filter((l) => l.windowId === r.monitorMaintenanceWindowId)
                .map((l) => ({ monitorId: l.monitorId }))
            : components
          ).flatMap((c) => {
            const m =
              c.monitorId == null ? undefined : monitorById.get(c.monitorId);
            return m ? [[m.id, m] as const] : [];
          }),
        ).values(),
      ].sort((a, b) => a.id - b.id),
      ...attributed(r),
    };
  });
}

export async function listMaintenances(args: {
  ctx: ServiceContext;
  input: ListMaintenancesInput;
}): Promise<ListMaintenancesResult> {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const input = ListMaintenancesInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [eq(maintenance.workspaceId, ctx.workspace.id)];
  if (input.pageId !== undefined) {
    conditions.push(eq(maintenance.pageId, input.pageId));
  }
  if (input.period !== undefined) {
    conditions.push(gte(maintenance.createdAt, periodToSince(input.period)));
  }
  if (input.monitorId !== undefined) {
    conditions.push(
      inArray(
        maintenance.id,
        db
          .select({ id: maintenancesToPageComponents.maintenanceId })
          .from(maintenancesToPageComponents)
          .innerJoin(
            pageComponent,
            eq(pageComponent.id, maintenancesToPageComponents.pageComponentId),
          )
          .where(eq(pageComponent.monitorId, input.monitorId)),
      ),
    );
  }
  const whereClause = and(...conditions);

  // Count and page queries run in parallel outside a transaction — a
  // concurrent insert between them can leave `totalSize` one off from the
  // returned page. Best-effort is fine for list pagination (Connect clients
  // re-fetch; tRPC callers use a 10k sentinel and ignore totalSize).
  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(maintenance)
      .where(whereClause)
      .get(),
    db
      .select()
      .from(maintenance)
      .where(whereClause)
      .orderBy(
        input.order === "asc"
          ? asc(maintenance.createdAt)
          : desc(maintenance.createdAt),
      )
      .limit(input.limit)
      .offset(input.offset)
      .all(),
  ]);

  const totalSize = countRow?.count ?? 0;
  const items = await enrichMaintenancesBatch(db, rows);
  return { items, totalSize };
}

export async function getMaintenance(args: {
  ctx: ServiceContext;
  input: GetMaintenanceInput;
}): Promise<MaintenanceWithRelations> {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  const input = GetMaintenanceInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const record = await getMaintenanceInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrichMaintenancesBatch(db, [record]);
  // oxlint-disable-next-line typescript/no-non-null-assertion -- always defined for len === 1
  return enriched!;
}
