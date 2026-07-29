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

/**
 * Finds an open incident (not resolved) for the given monitor.
 */
async function findOpenIncident(monitorId: number) {
  return db
    .select()
    .from(schema.incidentTable)
    .where(
      and(
        eq(schema.incidentTable.monitorId, monitorId),
        isNull(schema.incidentTable.resolvedAt),
      ),
    )
    .get();
}

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

    // Check if monitor has cloud regions
    const hasCloudRegions = monitor.regions && monitor.regions.trim().length > 0;

    // Query all private locations for threshold check
    const allLocations = await db
      .select({ id: schema.privateLocationToMonitors.privateLocationId })
      .from(schema.privateLocationToMonitors)
      .where(
        and(
          eq(schema.privateLocationToMonitors.monitorId, monitorIdNumber),
          isNull(schema.privateLocationToMonitors.deletedAt),
        ),
      )
      .all();

    const numberOfLocations = allLocations.length;
    const locationIds = allLocations.map((loc) => loc.id);

    // Count how many locations report this status
    const locationsWithStatus = await db
      .select({
        privateLocationId:
          schema.privateLocationMonitorStatus.privateLocationId,
      })
      .from(schema.privateLocationMonitorStatus)
      .where(
        and(
          eq(schema.privateLocationMonitorStatus.monitorId, monitorIdNumber),
          eq(schema.privateLocationMonitorStatus.status, status),
          inArray(
            schema.privateLocationMonitorStatus.privateLocationId,
            locationIds,
          ),
        ),
      )
      .all();

    const affectedLocationCount = locationsWithStatus.length;

    // Apply ≥50% threshold (matching cloud checker logic)
    const shouldTriggerIncident =
      !hasCloudRegions &&
      (affectedLocationCount >= numberOfLocations / 2 || numberOfLocations === 1);

    switch (status) {
      case "error":
        // Create incident only if private-only monitor AND threshold met
        if (shouldTriggerIncident) {
          try {
            const existingIncident = await findOpenIncident(monitorIdNumber);
            if (!existingIncident) {
              const [newIncident] = await db
                .insert(schema.incidentTable)
                .values({
                  monitorId: monitorIdNumber,
                  workspaceId: monitor.workspaceId,
                  startedAt: new Date(cronTimestamp),
                })
                .returning();

              if (newIncident?.id) {
                await checkerAudit.publishAuditLog({
                  id: `monitor:${monitorId}`,
                  action: "incident.created",
                  targets: [{ id: monitorId, type: "monitor" }],
                  metadata: { cronTimestamp, incidentId: newIncident.id },
                });
                logger.info("Created incident", {
                  incident_id: newIncident.id,
                  monitor_id: monitorId,
                  affected_location_count: affectedLocationCount,
                  total_locations: numberOfLocations,
                });
              }
            } else {
              logger.info("Already in incident", {
                incident_id: existingIncident.id,
              });
            }
          } catch (error) {
            logger.error("Failed to create incident", {
              monitor_id: monitorId,
              error_message: error instanceof Error ? error.message : String(error),
            });
          }
        }

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
        // Resolve incident only if private-only monitor AND threshold met
        if (shouldTriggerIncident) {
          try {
            const existingIncident = await findOpenIncident(monitorIdNumber);
            if (existingIncident && !existingIncident.resolvedAt) {
              await db
                .update(schema.incidentTable)
                .set({
                  resolvedAt: new Date(cronTimestamp),
                  autoResolved: true,
                })
                .where(eq(schema.incidentTable.id, existingIncident.id))
                .run();

              await checkerAudit.publishAuditLog({
                id: `monitor:${monitorId}`,
                action: "incident.resolved",
                targets: [{ id: monitorId, type: "monitor" }],
                metadata: { 
                  cronTimestamp, 
                  incidentId: existingIncident.id,
                  autoResolved: true,
                },
              });
              logger.info("Resolved incident", {
                incident_id: existingIncident.id,
                monitor_id: monitorId,
                affected_location_count: affectedLocationCount,
                total_locations: numberOfLocations,
              });
            }
          } catch (error) {
            logger.error("Failed to resolve incident", {
              monitor_id: monitorId,
              error_message: error instanceof Error ? error.message : String(error),
            });
          }
        }

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
