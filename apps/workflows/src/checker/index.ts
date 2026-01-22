import { Hono } from "hono";
import { z } from "zod";

import { and, db, eq, inArray, isNull, schema } from "@openstatus/db";
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

/**
 * Finds an open incident (not resolved and not acknowledged) for the given monitor.
 */
async function findOpenIncident(monitorId: number) {
  return db
    .select()
    .from(incidentTable)
    .where(
      and(
        eq(incidentTable.monitorId, monitorId),
        isNull(incidentTable.resolvedAt),
      ),
    )
    .get();
}

/**
 * Resolves an open incident by setting resolvedAt and autoResolved flag.
 */
async function resolveIncident(params: {
  monitorId: string;
  cronTimestamp: number;
}) {
  const { monitorId, cronTimestamp } = params;
  const incident = await findOpenIncident(Number(monitorId));

  if (!incident || incident.resolvedAt) {
    return null;
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

  return incident;
}

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

  // Fetch all affected regions for notifications (single query)
  const affectedRegions = await db
    .select({ region: schema.monitorStatusTable.region })
    .from(schema.monitorStatusTable)
    .where(
      and(
        eq(schema.monitorStatusTable.monitorId, monitor.id),
        eq(schema.monitorStatusTable.status, status),
        inArray(schema.monitorStatusTable.region, monitor.regions),
      ),
    )
    .all();

  const affectedRegionsList = affectedRegions.map((r) => r.region);
  const affectedRegionCount = affectedRegionsList.length;

  if (affectedRegionCount === 0) {
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

  if (affectedRegionCount >= numberOfRegions / 2 || numberOfRegions === 1) {
    switch (status) {
      case "active": {
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

        let incident = null;
        if (monitor.status === "error") {
          incident = await resolveIncident({ monitorId, cronTimestamp });
        }

        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "recovery",
          cronTimestamp,
          regions: affectedRegionsList,
          latency,
          incidentId: incident?.id,
        });

        break;
      }
      case "degraded":
        if (monitor.status === "degraded") {
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

        let incident = null;
        if (monitor.status === "error") {
          incident = await resolveIncident({
            monitorId,
            cronTimestamp,
          });
        }

        await triggerNotifications({
          monitorId,
          statusCode,
          message,
          notifType: "degraded",
          cronTimestamp,
          latency,
          regions: affectedRegionsList,
          incidentId: incident?.id,
        });

        break;
      case "error":
        if (monitor.status === "error") {
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
          const existingIncident = await findOpenIncident(Number(monitorId));
          if (existingIncident) {
            logger.info("Already in incident", {
              incident_id: existingIncident.id,
            });
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

          if (!newIncident?.id) {
            break;
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
            regions: affectedRegionsList,
            incidentId: newIncident.id,
          });
        } catch (error) {
          logger.warning("Failed to create incident", { error });
        }

        break;
      default:
        logger.error("should not happen");
        break;
    }
  }

  return c.text("Ok", 200);
});
