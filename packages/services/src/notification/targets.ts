import { db as defaultDb, eq } from "@openstatus/db";
import {
  monitor,
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";

/** Every notification linked to the monitor, joined with both rows; any workspace. */
export async function listMonitorNotificationTargets(args: {
  monitorId: number;
  db?: DB;
}) {
  return (args.db ?? defaultDb)
    .select()
    .from(notificationsToMonitors)
    .innerJoin(
      notification,
      eq(notification.id, notificationsToMonitors.notificationId),
    )
    .innerJoin(monitor, eq(monitor.id, notificationsToMonitors.monitorId))
    .where(eq(monitor.id, args.monitorId))
    .all();
}
