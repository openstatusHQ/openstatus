import {
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

  // Explicit column selection on the join — keeps the row shape in our
  // hands instead of relying on drizzle's auto-derived `row.<table_name>`
  // keys (named after the JS variable, fragile to schema renames).
  const assocRows = await db
    .select({
      notificationId: notificationsToMonitors.notificationId,
      monitor,
    })
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
  for (const row of assocRows) {
    const parsed = selectMonitorSchema.parse(row.monitor);
    const arr = monitorsByNotification.get(row.notificationId);
    if (arr) arr.push(parsed);
    else monitorsByNotification.set(row.notificationId, [parsed]);
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

  const whereClause = eq(notification.workspaceId, ctx.workspace.id);

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
      // Secondary sort by `id` (matching the primary direction) so
      // pages are stable when two rows share a `createdAt` — pure
      // `createdAt ORDER BY` can shuffle ties across requests, which
      // drops or duplicates rows at page boundaries.
      .orderBy(
        ...(input.order === "asc"
          ? [asc(notification.createdAt), asc(notification.id)]
          : [desc(notification.createdAt), desc(notification.id)]),
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
