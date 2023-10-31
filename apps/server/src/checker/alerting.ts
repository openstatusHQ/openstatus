import { db, eq, schema } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import {
  selectMonitorSchema,
  selectNotificationSchema,
} from "@openstatus/db/src/schema";

import { publishPingRetryPolicy } from "./checker";
import type { Payload } from "./schema";
import { providerToFunction } from "./utils";

export async function catchTooManyRetry(payload: Payload) {
  await publishPingRetryPolicy({ payload, latency: -1, statusCode: 500 });
  if (payload?.status !== "error") {
    await triggerAlerting({ monitorId: payload.monitorId });
    await updateMonitorStatus({
      monitorId: payload.monitorId,
      status: "error",
    });
  }
}

export const triggerAlerting = async ({ monitorId }: { monitorId: string }) => {
  console.log(`triggerAlerting for ${monitorId}`);
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
