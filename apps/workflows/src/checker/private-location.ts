import { getLogger } from "@logtape/logtape";
import { and, db, eq, gte, isNull, lte, schema, sql } from "@openstatus/db";
import { monitorStatusSchema } from "@openstatus/db/src/schema/monitors/validation";
import type { Context } from "hono";
import { z } from "zod";

import { env } from "../env";
import type { Env } from "../index";
import { checkerAudit } from "../utils/audit-log";
import { triggerNotifications } from "./alerting";

const logger = getLogger(["workflow"]);

const payloadSchema = z.object({
  monitorId: z.string(),
  privateLocationId: z.string(),
  status: monitorStatusSchema,
  cronTimestamp: z.number(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
  latency: z.number().optional(),
});

export async function updateStatusPrivate(c: Context<Env>) {
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env().CRON_SECRET}`) {
    logger.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const result = payloadSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.text("Unprocessable Entity", 422);
  }

  const {
    monitorId,
    privateLocationId,
    status,
    cronTimestamp,
    message,
    statusCode,
    latency,
  } = result.data;

  const monitorIdNumber = Number(monitorId);
  const privateLocationIdNumber = Number(privateLocationId);

  try {
    const monitor = await db
      .select()
      .from(schema.monitor)
      .where(eq(schema.monitor.id, monitorIdNumber))
      .get();

    if (!monitor || monitor.deletedAt || !monitor.active) {
      return c.json({ success: true }, 200);
    }

    const now = new Date();
    const activeMaintenance = await db
      .select({ id: schema.maintenance.id })
      .from(schema.maintenance)
      .innerJoin(
        schema.maintenancesToPageComponents,
        eq(
          schema.maintenancesToPageComponents.maintenanceId,
          schema.maintenance.id,
        ),
      )
      .innerJoin(
        schema.pageComponent,
        eq(
          schema.pageComponent.id,
          schema.maintenancesToPageComponents.pageComponentId,
        ),
      )
      .where(
        and(
          lte(schema.maintenance.from, now),
          gte(schema.maintenance.to, now),
          eq(schema.pageComponent.monitorId, monitorIdNumber),
        ),
      )
      .get();

    if (activeMaintenance) {
      return c.json({ success: true }, 200);
    }

    const attachment = await db
      .select({ name: schema.privateLocation.name })
      .from(schema.privateLocationToMonitors)
      .innerJoin(
        schema.privateLocation,
        eq(
          schema.privateLocation.id,
          schema.privateLocationToMonitors.privateLocationId,
        ),
      )
      .where(
        and(
          eq(schema.privateLocationToMonitors.monitorId, monitorIdNumber),
          eq(
            schema.privateLocationToMonitors.privateLocationId,
            privateLocationIdNumber,
          ),
          isNull(schema.privateLocationToMonitors.deletedAt),
        ),
      )
      .get();

    if (!attachment) {
      return c.json({ success: true }, 200);
    }

    const priorRow = await db
      .select({ status: schema.privateLocationMonitorStatus.status })
      .from(schema.privateLocationMonitorStatus)
      .where(
        and(
          eq(schema.privateLocationMonitorStatus.monitorId, monitorIdNumber),
          eq(
            schema.privateLocationMonitorStatus.privateLocationId,
            privateLocationIdNumber,
          ),
        ),
      )
      .get();

    const priorStatus = priorRow?.status ?? "active";

    const upserted = await db
      .insert(schema.privateLocationMonitorStatus)
      .values({
        monitorId: monitorIdNumber,
        privateLocationId: privateLocationIdNumber,
        status,
        cronTimestamp,
      })
      .onConflictDoUpdate({
        target: [
          schema.privateLocationMonitorStatus.monitorId,
          schema.privateLocationMonitorStatus.privateLocationId,
        ],
        set: { status, cronTimestamp, updatedAt: new Date() },
        setWhere: sql`excluded.cron_timestamp > ${schema.privateLocationMonitorStatus.cronTimestamp}`,
      })
      .returning();

    if (upserted.length === 0 || status === priorStatus) {
      return c.json({ success: true }, 200);
    }

    const regions = [attachment.name];

    switch (status) {
      case "error":
        await checkerAudit.publishAuditLog({
          id: `monitor:${monitorId}`,
          action: "monitor.failed",
          targets: [{ id: monitorId, type: "monitor" }],
          metadata: {
            region: privateLocationId,
            statusCode: statusCode ?? -1,
            message,
            cronTimestamp,
            latency,
          },
        });
        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "alert",
          cronTimestamp,
          regions,
          latency,
        });
        break;
      case "degraded":
        await checkerAudit.publishAuditLog({
          id: `monitor:${monitorId}`,
          action: "monitor.degraded",
          targets: [{ id: monitorId, type: "monitor" }],
          metadata: {
            region: privateLocationId,
            statusCode: statusCode ?? -1,
            cronTimestamp,
            latency,
          },
        });
        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "degraded",
          cronTimestamp,
          regions,
          latency,
        });
        break;
      case "active":
        await checkerAudit.publishAuditLog({
          id: `monitor:${monitorId}`,
          action: "monitor.recovered",
          targets: [{ id: monitorId, type: "monitor" }],
          metadata: {
            region: privateLocationId,
            statusCode: statusCode ?? -1,
            cronTimestamp,
            latency,
          },
        });
        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "recovery",
          cronTimestamp,
          regions,
          latency,
        });
        break;
    }

    return c.json({ success: true }, 200);
  } catch (error) {
    logger.error("Failed to update private location status", {
      monitor_id: monitorId,
      private_location_id: privateLocationId,
      error_message: error instanceof Error ? error.message : String(error),
    });
    return c.text("Internal Server Error", 500);
  }
}
