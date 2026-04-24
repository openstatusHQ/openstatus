import {
  type SQL,
  and,
  asc,
  db as defaultDb,
  desc,
  eq,
  inArray,
  isNull,
  sql,
} from "@openstatus/db";
import {
  incidentTable,
  monitor,
  monitorTag,
  monitorTagsToMonitors,
  notification,
  notificationsToMonitors,
  privateLocation,
  privateLocationToMonitors,
  selectIncidentSchema,
  selectMonitorSchema,
  selectMonitorTagSchema,
  selectNotificationSchema,
  selectPrivateLocationSchema,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type {
  Incident,
  Monitor,
  MonitorTag,
  Notification,
  PrivateLocation,
} from "../types";
import { getMonitorInWorkspace } from "./internal";
import { GetMonitorInput, ListMonitorsInput } from "./schemas";

export type MonitorListItem = Monitor & {
  tags: MonitorTag[];
  incidents: Incident[];
};

export type MonitorWithRelations = Monitor & {
  tags: MonitorTag[];
  incidents: Incident[];
  notifications: Notification[];
  privateLocations: PrivateLocation[];
};

export type ListMonitorsResult = {
  items: MonitorListItem[];
  totalSize: number;
};

/**
 * Batched enrichment for a list of monitors — loads tags + incidents in
 * two IN queries (three if notifications / privateLocations are also
 * requested). Avoids the per-row pattern that pairs badly with dashboards
 * that don't paginate.
 */
async function enrichMonitorsBatch(
  db: DB,
  rows: Array<typeof monitor.$inferSelect>,
  workspaceId: number,
  include: { notifications?: boolean; privateLocations?: boolean } = {},
): Promise<MonitorWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  // Explicit column selection (not `select()`) keeps the join row shape in
  // our hands instead of relying on drizzle's auto-derived `row.<table_name>`
  // keys, which are named after the JS variable and silently break on
  // schema rename.
  const [tagRows, incidentRows, notifRows, locRows] = await Promise.all([
    db
      .select({
        monitorId: monitorTagsToMonitors.monitorId,
        tag: monitorTag,
      })
      .from(monitorTag)
      .innerJoin(
        monitorTagsToMonitors,
        eq(monitorTagsToMonitors.monitorTagId, monitorTag.id),
      )
      .where(
        and(
          inArray(monitorTagsToMonitors.monitorId, ids),
          eq(monitorTag.workspaceId, workspaceId),
        ),
      )
      .all(),
    db
      .select()
      .from(incidentTable)
      .where(
        and(
          inArray(incidentTable.monitorId, ids),
          // Scope to caller's workspace — defence-in-depth in case an
          // incident.monitorId somehow points cross-workspace. The
          // `incident.monitorId` FK doesn't enforce workspace ownership.
          eq(incidentTable.workspaceId, workspaceId),
        ),
      )
      .all(),
    include.notifications
      ? db
          .select({
            monitorId: notificationsToMonitors.monitorId,
            notification,
          })
          .from(notification)
          .innerJoin(
            notificationsToMonitors,
            eq(notificationsToMonitors.notificationId, notification.id),
          )
          .where(
            and(
              inArray(notificationsToMonitors.monitorId, ids),
              eq(notification.workspaceId, workspaceId),
            ),
          )
          .all()
      : Promise.resolve([]),
    include.privateLocations
      ? db
          .select({
            monitorId: privateLocationToMonitors.monitorId,
            location: privateLocation,
          })
          .from(privateLocation)
          .innerJoin(
            privateLocationToMonitors,
            eq(privateLocationToMonitors.privateLocationId, privateLocation.id),
          )
          .where(
            and(
              inArray(privateLocationToMonitors.monitorId, ids),
              eq(privateLocation.workspaceId, workspaceId),
            ),
          )
          .all()
      : Promise.resolve([]),
  ]);

  const tagsByMonitor = new Map<number, MonitorTag[]>();
  for (const row of tagRows) {
    const tag = selectMonitorTagSchema.parse(row.tag);
    const arr = tagsByMonitor.get(row.monitorId);
    if (arr) arr.push(tag);
    else tagsByMonitor.set(row.monitorId, [tag]);
  }

  const incidentsByMonitor = new Map<number, Incident[]>();
  for (const row of incidentRows) {
    if (row.monitorId == null) continue;
    const incident = selectIncidentSchema.parse(row);
    const arr = incidentsByMonitor.get(row.monitorId);
    if (arr) arr.push(incident);
    else incidentsByMonitor.set(row.monitorId, [incident]);
  }

  const notifsByMonitor = new Map<number, Notification[]>();
  for (const row of notifRows) {
    const parsed = selectNotificationSchema.parse(row.notification);
    const arr = notifsByMonitor.get(row.monitorId);
    if (arr) arr.push(parsed);
    else notifsByMonitor.set(row.monitorId, [parsed]);
  }

  const locsByMonitor = new Map<number, PrivateLocation[]>();
  for (const row of locRows) {
    if (row.monitorId == null) continue;
    const parsed = selectPrivateLocationSchema.parse(row.location);
    const arr = locsByMonitor.get(row.monitorId);
    if (arr) arr.push(parsed);
    else locsByMonitor.set(row.monitorId, [parsed]);
  }

  return rows.map((r) => ({
    ...selectMonitorSchema.parse(r),
    tags: tagsByMonitor.get(r.id) ?? [],
    incidents: incidentsByMonitor.get(r.id) ?? [],
    notifications: notifsByMonitor.get(r.id) ?? [],
    privateLocations: locsByMonitor.get(r.id) ?? [],
  }));
}

export async function listMonitors(args: {
  ctx: ServiceContext;
  input: ListMonitorsInput;
}): Promise<ListMonitorsResult> {
  const { ctx } = args;
  const input = ListMonitorsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [
    eq(monitor.workspaceId, ctx.workspace.id),
    isNull(monitor.deletedAt),
  ];
  const whereClause = and(...conditions);

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(monitor)
      .where(whereClause)
      .get(),
    db
      .select()
      .from(monitor)
      .where(whereClause)
      .orderBy(
        input.order === "asc" ? asc(monitor.active) : desc(monitor.active),
        input.order === "asc"
          ? asc(monitor.createdAt)
          : desc(monitor.createdAt),
      )
      .limit(input.limit)
      .offset(input.offset)
      .all(),
  ]);

  const totalSize = countRow?.count ?? 0;
  const enriched = await enrichMonitorsBatch(db, rows, ctx.workspace.id);
  // `list` only exposes tags + incidents to match the tRPC `list` shape.
  const items: MonitorListItem[] = enriched.map(
    ({ notifications: _n, privateLocations: _p, ...rest }) => rest,
  );
  return { items, totalSize };
}

export async function getMonitor(args: {
  ctx: ServiceContext;
  input: GetMonitorInput;
}): Promise<MonitorWithRelations> {
  const { ctx } = args;
  const input = GetMonitorInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const record = await getMonitorInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrichMonitorsBatch(db, [record], ctx.workspace.id, {
    notifications: true,
    privateLocations: true,
  });
  // biome-ignore lint/style/noNonNullAssertion: always defined for len === 1
  return enriched!;
}
