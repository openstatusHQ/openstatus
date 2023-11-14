import { db, eq, schema } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import {
  selectMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { flyRegionsDict } from "@openstatus/utils";

import { providerToFunction } from "./utils";

export const triggerAlerting = async ({
  monitorId,
  region,
  statusCode,
  message,
}: {
  monitorId: string;
  region: keyof typeof flyRegionsDict;
  statusCode?: number;
  message?: string;
}) => {
  console.log(`💌 triggerAlerting for ${monitorId}`);
  const notifications = await db
    .select()
    .from(schema.notificationsToMonitors)
    .innerJoin(
      schema.notification,
      eq(schema.notification.id, schema.notificationsToMonitors.notificationId),
    )
    .innerJoin(
      schema.monitor,
      eq(schema.monitor.id, schema.notificationsToMonitors.monitorId),
    )
    .where(eq(schema.monitor.id, Number(monitorId)))
    .all();
  for (const notif of notifications) {
    const monitor = selectMonitorSchema.parse(notif.monitor);
    await providerToFunction[notif.notification.provider]({
      monitor,
      notification: selectNotificationSchema.parse(notif.notification),
      region: flyRegionsDict[region].location,
      statusCode,
      message,
    });
  }
};

export const updateMonitorStatus = async ({
  monitorId,
  status,
}: {
  monitorId: string;
  status: MonitorStatus;
}) => {
  await db
    .update(schema.monitor)
    .set({ status })
    .where(eq(schema.monitor.id, Number(monitorId)))
    .run();
};
