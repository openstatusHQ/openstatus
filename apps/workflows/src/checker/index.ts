import { Hono } from "hono";
import { z } from "zod";

import { and, count, db, eq, inArray, isNull, schema } from "@openstatus/db";
import { incidentTable } from "@openstatus/db/src/schema";
import {
  monitorStatusSchema,
  selectMonitorSchema,
} from "@openstatus/db/src/schema/monitors/validation";

import { getLogger } from "@logtape/logtape";
import { monitorRegions } from "@openstatus/db/src/schema/constants";
import { env } from "../env";
import type { Env } from "../index";
import { checkerAudit } from "../utils/audit-log";
import { triggerNotifications, upsertMonitorStatus } from "./alerting";

export const checkerRoute = new Hono<Env>();

const payloadSchema = z.object({
  monitorId: z.string(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
  region: z.enum(monitorRegions),
  cronTimestamp: z.number(),
  status: monitorStatusSchema,
  latency: z.number().optional(),
});

const logger = getLogger(["workflow"]);

checkerRoute.post("/updateStatus", async (c) => {
  const auth = c.req.header("Authorization");
  if (auth !== `Basic ${env().CRON_SECRET}`) {
    logger.error("Unauthorized");
    return c.text("Unauthorized", 401);
  }

  const event = c.get("event");
  const json = await c.req.json();

  const result = payloadSchema.safeParse(json);

  if (!result.success) {
    return c.text("Unprocessable Entity", 422);
  }
  event.status_update = {
    status: result.data.status,
    message: result.data.message,
    region: result.data.region,
    status_code: result.data.statusCode,
    cron_timestamp: result.data.cronTimestamp,
    latency_ms: result.data.latency,
  };

  const {
    monitorId,
    message,
    region,
    statusCode,
    cronTimestamp,
    status,
    latency,
  } = result.data;

  logger.info("Updating monitor status", {
    monitor_id: monitorId,
    region,
    status,
    status_code: statusCode,
    cron_timestamp: cronTimestamp,
    latency_ms: latency,
  });

  // First we upsert the monitor status
  await upsertMonitorStatus({
    monitorId: monitorId,
    status,
    region: region,
  });

  const currentMonitor = await db
    .select()
    .from(schema.monitor)
    .where(eq(schema.monitor.id, Number(monitorId)))
    .get();

  const monitor = selectMonitorSchema.parse(currentMonitor);
  const numberOfRegions = monitor.regions.length;

  const affectedRegion = await db
    .select({ count: count() })
    .from(schema.monitorStatusTable)
    .where(
      and(
        eq(schema.monitorStatusTable.monitorId, monitor.id),
        eq(schema.monitorStatusTable.status, status),
        inArray(schema.monitorStatusTable.region, monitor.regions),
      ),
    )
    .get();

  if (!affectedRegion?.count) {
    return c.json({ success: true }, 200);
  }

  // audit log the current state of the ping

  switch (status) {
    case "active":
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.recovered",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: {
          region,
          statusCode: statusCode ?? -1,
          cronTimestamp,
          latency,
        },
      });
      break;
    case "degraded":
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.degraded",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: {
          region,
          statusCode: statusCode ?? -1,
          cronTimestamp,
          latency,
        },
      });
      break;
    case "error":
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "monitor.failed",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: {
          region,
          statusCode: statusCode ?? -1,
          message,
          cronTimestamp,
          latency,
        },
      });
      break;
  }

  if (affectedRegion.count >= numberOfRegions / 2 || numberOfRegions === 1) {
    switch (status) {
      case "active": {
        // it's been resolved
        if (monitor.status === "active") {
          break;
        }

        logger.info("Monitor status changed to active", {
          monitor_id: monitor.id,
          workspace_id: monitor.workspaceId,
        });
        await db
          .update(schema.monitor)
          .set({ status: "active" })
          .where(eq(schema.monitor.id, monitor.id));

        // we can't have a monitor in error without an incident
        if (monitor.status === "error") {
          const incident = await db
            .select()
            .from(incidentTable)
            .where(
              and(
                eq(incidentTable.monitorId, Number(monitorId)),
                isNull(incidentTable.resolvedAt),
                isNull(incidentTable.acknowledgedAt),
              ),
            )
            .get();

          if (!incident) {
            // it was just a single failure not a proper incident
            break;
          }
          if (incident?.resolvedAt) {
            // incident is already resolved
            break;
          }
          logger.info("Recovering incident", {
            incident_id: incident.id,
            monitor_id: monitorId,
          });

          await db
            .update(incidentTable)
            .set({
              resolvedAt: new Date(cronTimestamp),
              autoResolved: true,
            })
            .where(eq(incidentTable.id, incident.id))
            .run();

          await checkerAudit.publishAuditLog({
            id: `monitor:${monitorId}`,
            action: "incident.resolved",
            targets: [{ id: monitorId, type: "monitor" }],
            metadata: { cronTimestamp, incidentId: incident.id },
          });
        }

        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "recovery",
          cronTimestamp,
          region,
          latency,
          incidentId: `${cronTimestamp}`,
        });

        break;
      }
      case "degraded":
        if (monitor.status === "degraded") {
          // already degraded let's return early
          break;
        }
        logger.info("Monitor status changed to degraded", {
          monitor_id: monitor.id,
          workspace_id: monitor.workspaceId,
        });

        await db
          .update(schema.monitor)
          .set({ status: "degraded" })
          .where(eq(schema.monitor.id, monitor.id));
        // figure how to send the notification once
        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "degraded",
          cronTimestamp,
          latency,
          region,
          incidentId: `${cronTimestamp}`,
        });

        break;
      case "error":
        if (monitor.status === "error") {
          // already in error let's return early
          break;
        }

        logger.info("Monitor status changed to error", {
          monitor_id: monitor.id,
          workspace_id: monitor.workspaceId,
        });

        await db
          .update(schema.monitor)
          .set({ status: "error" })
          .where(eq(schema.monitor.id, monitor.id));

        try {
          const incident = await db
            .select()
            .from(incidentTable)
            .where(
              and(
                eq(incidentTable.monitorId, Number(monitorId)),
                isNull(incidentTable.resolvedAt),
                isNull(incidentTable.acknowledgedAt),
              ),
            )
            .get();
          if (incident) {
            logger.info("we are already in incident");
            break;
          }
          const [newIncident] = await db
            .insert(incidentTable)
            .values({
              monitorId: Number(monitorId),
              workspaceId: monitor.workspaceId,
              startedAt: new Date(cronTimestamp),
            })
            .returning();

          if (!newIncident.id) {
            return;
          }

          await checkerAudit.publishAuditLog({
            id: `monitor:${monitorId}`,
            action: "incident.created",
            targets: [{ id: monitorId, type: "monitor" }],
            metadata: { cronTimestamp, incidentId: newIncident.id },
          });

          await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "alert",
            cronTimestamp,
            latency,
            region,
            incidentId: String(newIncident.id),
          });

          await db
            .update(schema.monitor)
            .set({ status: "error" })
            .where(eq(schema.monitor.id, monitor.id));
        } catch {
          logger.warning("incident was already created");
        }

        break;
      default:
        logger.error("should not happen");
        break;
    }
  }

  // if we are in error
  return c.text("Ok", 200);
});
