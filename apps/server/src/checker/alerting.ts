import { db, eq, schema } from "@openstatus/db";
import type { MonitorRegion, MonitorStatus } from "@openstatus/db/src/schema";
import {
  selectMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";
import { flyRegionsDict } from "@openstatus/utils";

import { env } from "../env";
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

export const upsertMonitorStatus = async ({
  monitorId,
  status,
}: {
  monitorId: string;
  status: MonitorStatus;
}) => {
  const region = env.FLY_REGION as MonitorRegion;
  await db
    .insert(schema.monitorStatusTable)
    .values({ status, region, monitorId: Number(monitorId) })
    .onConflictDoUpdate({
      target: [
        schema.monitorStatusTable.monitorId,
        schema.monitorStatusTable.region,
      ],
      set: { status },
    });
};
