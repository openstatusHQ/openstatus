import type { z } from "zod";

import { db, eq, schema } from "@openstatus/db";
import { selectNotificationSchema } from "@openstatus/db/src/schema";

import { monitor } from "./checker";
import type { Payload } from "./schema";
import { providerToFunction } from "./utils";

export async function catchTooManyRetry(payload: Payload) {
  await monitor({ monitorInfo: payload, latency: -1, statusCode: 500 });
  if (payload?.status !== "error") {
    await triggerAlerting({ monitorId: payload.monitorId });
    await updateMonitorStatus({
      monitorId: payload.monitorId,
      status: "error",
    });
  }
}

export const triggerAlerting = async ({ monitorId }: { monitorId: string }) => {
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
    await providerToFunction[notif.notification.provider]({
      monitor: notif.monitor,
      notification: selectNotificationSchema.parse(notif.notification),
    });
  }
};

export const updateMonitorStatus = async ({
  monitorId,
  status,
}: {
  monitorId: string;
  status: z.infer<typeof schema.statusSchema>;
}) => {
  await db
    .update(schema.monitor)
    .set({ status })
    .where(eq(schema.monitor.id, Number(monitorId)))
    .run();
};
