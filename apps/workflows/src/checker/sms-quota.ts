import { and, count, db, eq, gte, inArray } from "@openstatus/db";
import {
  notification,
  notificationTrigger,
  selectWorkspaceSchema,
  workspace,
} from "@openstatus/db/src/schema";
import { withBusyRetry } from "@openstatus/services";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * `cron_timestamp` is stored in milliseconds; comparing it against a
 * seconds-resolution cutoff made the window unbounded, so every workspace that
 * had ever passed its limit stayed blocked.
 *
 * Two round trips regardless of how many workspaces are asked about.
 */
export async function loadSmsQuotaBlocked(
  workspaceIds: number[],
): Promise<Map<number, boolean>> {
  const blocked = new Map<number, boolean>();
  if (workspaceIds.length === 0) return blocked;

  const [workspaceRows, notificationRows] = await withBusyRetry(() =>
    db.batch([
      db.select().from(workspace).where(inArray(workspace.id, workspaceIds)),
      db
        .select({ id: notification.id, workspaceId: notification.workspaceId })
        .from(notification)
        .where(
          and(
            inArray(notification.workspaceId, workspaceIds),
            eq(notification.provider, "sms"),
          ),
        ),
    ]),
  );

  const notificationsByWorkspace = new Map<number, number[]>();
  for (const row of notificationRows) {
    if (row.workspaceId === null) continue;
    const ids = notificationsByWorkspace.get(row.workspaceId) ?? [];
    ids.push(row.id);
    notificationsByWorkspace.set(row.workspaceId, ids);
  }

  const notificationIds = notificationRows.map((row) => row.id);
  const sentRows =
    notificationIds.length === 0
      ? []
      : await withBusyRetry(() =>
          db
            .select({
              notificationId: notificationTrigger.notificationId,
              total: count(),
            })
            .from(notificationTrigger)
            .where(
              and(
                inArray(notificationTrigger.notificationId, notificationIds),
                gte(
                  notificationTrigger.cronTimestamp,
                  Date.now() - THIRTY_DAYS_MS,
                ),
              ),
            )
            .groupBy(notificationTrigger.notificationId)
            .all(),
        );

  const sentByNotification = new Map<number, number>();
  for (const row of sentRows) {
    if (row.notificationId === null) continue;
    sentByNotification.set(row.notificationId, row.total);
  }

  for (const row of workspaceRows) {
    const parsed = selectWorkspaceSchema.safeParse(row);
    if (!parsed.success) {
      blocked.set(row.id, true);
      continue;
    }
    const ids = notificationsByWorkspace.get(row.id) ?? [];
    const sent = ids.reduce(
      (total, id) => total + (sentByNotification.get(id) ?? 0),
      0,
    );
    blocked.set(row.id, sent > parsed.data.limits["sms-limit"]);
  }

  return blocked;
}
