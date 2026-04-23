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
  selectMonitorSchema,
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
  include: { notifications?: boolean; privateLocations?: boolean } = {},
): Promise<MonitorWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const [tagRows, incidentRows, notifRows, locRows] = await Promise.all([
    db
      .select()
      .from(monitorTag)
      .innerJoin(
        monitorTagsToMonitors,
        eq(monitorTagsToMonitors.monitorTagId, monitorTag.id),
      )
      .where(inArray(monitorTagsToMonitors.monitorId, ids))
      .all(),
    db
      .select()
      .from(incidentTable)
      .where(inArray(incidentTable.monitorId, ids))
      .all(),
    include.notifications
      ? db
          .select()
          .from(notification)
          .innerJoin(
            notificationsToMonitors,
            eq(notificationsToMonitors.notificationId, notification.id),
          )
          .where(inArray(notificationsToMonitors.monitorId, ids))
          .all()
      : Promise.resolve([] as never[]),
    include.privateLocations
      ? db
          .select()
          .from(privateLocation)
          .innerJoin(
            privateLocationToMonitors,
            eq(privateLocationToMonitors.privateLocationId, privateLocation.id),
          )
          .where(inArray(privateLocationToMonitors.monitorId, ids))
          .all()
      : Promise.resolve([] as never[]),
  ]);

  const tagsByMonitor = new Map<number, MonitorTag[]>();
  for (const row of tagRows as Array<{
    monitor_tag: MonitorTag;
    monitor_tag_to_monitor: { monitorId: number };
  }>) {
    const mId = row.monitor_tag_to_monitor.monitorId;
    const arr = tagsByMonitor.get(mId);
    if (arr) arr.push(row.monitor_tag);
    else tagsByMonitor.set(mId, [row.monitor_tag]);
  }

  const incidentsByMonitor = new Map<number, Incident[]>();
  for (const row of incidentRows as Incident[]) {
    if (row.monitorId == null) continue;
    const arr = incidentsByMonitor.get(row.monitorId);
    if (arr) arr.push(row);
    else incidentsByMonitor.set(row.monitorId, [row]);
  }

  const notifsByMonitor = new Map<number, Notification[]>();
  for (const row of notifRows as Array<{
    notification: Notification;
    notifications_to_monitors: { monitorId: number };
  }>) {
    const mId = row.notifications_to_monitors.monitorId;
    const arr = notifsByMonitor.get(mId);
    if (arr) arr.push(row.notification);
    else notifsByMonitor.set(mId, [row.notification]);
  }

  const locsByMonitor = new Map<number, PrivateLocation[]>();
  for (const row of locRows as Array<{
    private_location: PrivateLocation;
    private_location_to_monitor: { monitorId: number };
  }>) {
    const mId = row.private_location_to_monitor.monitorId;
    const arr = locsByMonitor.get(mId);
    if (arr) arr.push(row.private_location);
    else locsByMonitor.set(mId, [row.private_location]);
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
  const enriched = await enrichMonitorsBatch(db, rows);
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
  const [enriched] = await enrichMonitorsBatch(db, [record], {
    notifications: true,
    privateLocations: true,
  });
  // biome-ignore lint/style/noNonNullAssertion: always defined for len === 1
  return enriched!;
}
