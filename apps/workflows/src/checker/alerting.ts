import { and, count, db, eq, gte, inArray, schema } from "@openstatus/db";
import type { MonitorStatus } from "@openstatus/db/src/schema";
import {
  selectMonitorSchema,
  selectNotificationSchema,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";

import { getLogger } from "@logtape/logtape";
import type { Region } from "@openstatus/db/src/schema/constants";
import { checkerAudit } from "../utils/audit-log";
import { providerToFunction } from "./utils";

const logger = getLogger("workflow");

export const triggerNotifications = async ({
  monitorId,
  statusCode,
  message,
  notifType,
  cronTimestamp,
  incidentId,
  region,
  latency,
}: {
  monitorId: string;
  statusCode?: number;
  message?: string;
  notifType: "alert" | "recovery" | "degraded";
  cronTimestamp: number;
  incidentId: string;
  region?: Region;
  latency?: number;
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
    // for sms check we are in the quota
    if (notif.notification.provider === "sms") {
      if (notif.notification.workspaceId === null) {
        continue;
      }

      const workspace = await db
        .select()
        .from(schema.workspace)
        .where(eq(schema.workspace.id, notif.notification.workspaceId));

      if (workspace.length !== 1) {
        continue;
      }

      const data = selectWorkspaceSchema.parse(workspace[0]);

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const smsNotification = await db
        .select()
        .from(schema.notification)
        .where(
          and(
            eq(schema.notification.workspaceId, notif.notification.workspaceId),
            eq(schema.notification.provider, "sms"),
          ),
        );
      const ids = smsNotification.map((notification) => notification.id);

      const smsSent = await db
        .select({ count: count() })
        .from(schema.notificationTrigger)
        .where(
          and(
            gte(
              schema.notificationTrigger.cronTimestamp,
              Math.floor(oneMonthAgo.getTime() / 1000),
            ),
            inArray(schema.notificationTrigger.notificationId, ids),
          ),
        )
        .all();

      if ((smsSent[0]?.count ?? 0) > data.limits["sms-limit"]) {
        logger.warn(
          `SMS quota exceeded for workspace ${notif.notification.workspaceId}`,
        );
        continue;
      }
    }
    logger.info(
      `💌 sending notification for ${monitorId} and chanel ${notif.notification.provider} for ${notifType}`,
    );
    const monitor = selectMonitorSchema.parse(notif.monitor);
    try {
      await insertNotificationTrigger({
        monitorId: monitor.id,
        notificationId: notif.notification.id,
        cronTimestamp: cronTimestamp,
      });
    } catch (_e) {
      logger.error("notification trigger already exists dont send again");
      continue;
    }
    switch (notifType) {
      case "alert":
        await providerToFunction[notif.notification.provider].sendAlert({
          monitor,
          notification: selectNotificationSchema.parse(notif.notification),
          statusCode,
          message,
          incidentId,
          cronTimestamp,
          region,
          latency,
        });
        break;
      case "recovery":
        await providerToFunction[notif.notification.provider].sendRecovery({
          monitor,
          notification: selectNotificationSchema.parse(notif.notification),
          statusCode,
          message,
          incidentId,
          cronTimestamp,
          region,
          latency,
        });
        break;
      case "degraded":
        await providerToFunction[notif.notification.provider].sendDegraded({
          monitor,
          notification: selectNotificationSchema.parse(notif.notification),
          statusCode,
          message,
          cronTimestamp,
          region,
          latency,
        });
        break;
    }
    // ALPHA
    await checkerAudit.publishAuditLog({
      id: `monitor:${monitorId}`,
      action: "notification.sent",
      targets: [{ id: monitorId, type: "monitor" }],
      metadata: {
        provider: notif.notification.provider,
        cronTimestamp,
        type: notifType,
        notificationId: notif.notification.id,
      },
    });
    //
  }
};

const insertNotificationTrigger = async ({
  monitorId,
  notificationId,
  cronTimestamp,
}: {
  monitorId: number;
  notificationId: number;
  cronTimestamp: number;
}) => {
  await db
    .insert(schema.notificationTrigger)
    .values({
      monitorId: Number(monitorId),
      notificationId: notificationId,
      cronTimestamp: cronTimestamp,
    })
    .returning();
};

export const upsertMonitorStatus = async ({
  monitorId,
  status,
  region,
}: {
  monitorId: string;
  status: MonitorStatus;
  region: Region;
}) => {
  const newData = await db
    .insert(schema.monitorStatusTable)
    .values({ status, region, monitorId: Number(monitorId) })
    .onConflictDoUpdate({
      target: [
        schema.monitorStatusTable.monitorId,
        schema.monitorStatusTable.region,
      ],
      set: { status, updatedAt: new Date() },
    })
    .returning();
  logger.info(`📈 upsertMonitorStatus for ${monitorId} in region ${region}`);
  logger.info("🤔 upsert monitor {*}", { ...newData });
};
