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
  monitor,
  notification,
  notificationsToMonitors,
  selectMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import type { DB, ServiceContext } from "../context";
import type { Monitor, Notification } from "../types";
import { getNotificationInWorkspace } from "./internal";
import { GetNotificationInput, ListNotificationsInput } from "./schemas";

export type NotificationWithRelations = Notification & {
  monitors: Monitor[];
};

export type ListNotificationsResult = {
  items: NotificationWithRelations[];
  totalSize: number;
};

/**
 * Load monitors for a set of notifications in a single IN query. Scoped to
 * the caller's workspace and excluding soft-deleted monitors for
 * defence-in-depth.
 */
async function enrichNotificationsBatch(
  db: DB,
  rows: Array<typeof notification.$inferSelect>,
  workspaceId: number,
): Promise<NotificationWithRelations[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);

  const assocRows = await db
    .select()
    .from(monitor)
    .innerJoin(
      notificationsToMonitors,
      eq(notificationsToMonitors.monitorId, monitor.id),
    )
    .where(
      and(
        inArray(notificationsToMonitors.notificationId, ids),
        eq(monitor.workspaceId, workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();

  const monitorsByNotification = new Map<number, Monitor[]>();
  for (const row of assocRows as Array<{
    monitor: typeof monitor.$inferSelect;
    notifications_to_monitors: { notificationId: number };
  }>) {
    const nId = row.notifications_to_monitors.notificationId;
    const parsed = selectMonitorSchema.parse(row.monitor);
    const arr = monitorsByNotification.get(nId);
    if (arr) arr.push(parsed);
    else monitorsByNotification.set(nId, [parsed]);
  }

  return rows.map((r) => ({
    ...selectNotificationSchema.parse(r),
    monitors: monitorsByNotification.get(r.id) ?? [],
  }));
}

export async function listNotifications(args: {
  ctx: ServiceContext;
  input: ListNotificationsInput;
}): Promise<ListNotificationsResult> {
  const { ctx } = args;
  const input = ListNotificationsInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const conditions: SQL[] = [eq(notification.workspaceId, ctx.workspace.id)];
  const whereClause = and(...conditions);

  const [countRow, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(notification)
      .where(whereClause)
      .get(),
    db
      .select()
      .from(notification)
      .where(whereClause)
      .orderBy(
        input.order === "asc"
          ? asc(notification.createdAt)
          : desc(notification.createdAt),
      )
      .limit(input.limit)
      .offset(input.offset)
      .all(),
  ]);

  const totalSize = countRow?.count ?? 0;
  const items = await enrichNotificationsBatch(db, rows, ctx.workspace.id);
  return { items, totalSize };
}

export async function getNotification(args: {
  ctx: ServiceContext;
  input: GetNotificationInput;
}): Promise<NotificationWithRelations> {
  const { ctx } = args;
  const input = GetNotificationInput.parse(args.input);
  const db = ctx.db ?? defaultDb;
  const record = await getNotificationInWorkspace({
    tx: db,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
  const [enriched] = await enrichNotificationsBatch(
    db,
    [record],
    ctx.workspace.id,
  );
  // biome-ignore lint/style/noNonNullAssertion: always defined for len === 1
  return enriched!;
}
