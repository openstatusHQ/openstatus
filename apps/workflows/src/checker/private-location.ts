import { getLogger } from "@logtape/logtape";
import { and, db, eq, inArray, isNull, or, schema } from "@openstatus/db";
import {
  monitorInMaintenance,
  monitorInWindow,
} from "@openstatus/db/src/maintenance";
import { monitorStatusSchema } from "@openstatus/db/src/schema/monitors/validation";
import { setMonitorStatus } from "@openstatus/services/monitor";
import { recordPrivateLocationMonitorStatus } from "@openstatus/services/private-location";
import type { Context } from "hono";
import { z } from "zod";

import { env } from "../env";
import type { Env } from "../index";
import { checkerAudit } from "../utils/audit-log";
import { systemContext } from "../utils/system-context";
import { triggerNotifications } from "./alerting";
import { openIncident, resolveIncident } from "./incident-utils";

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

type MonitorStatus = z.infer<typeof monitorStatusSchema>;

async function applyMonitorStatus(
  monitor: { id: number; workspaceId: number | null },
  status: MonitorStatus,
) {
  // unreachable: private-only monitors without a workspace return earlier
  if (monitor.workspaceId === null) return;
  await setMonitorStatus({
    ctx: await systemContext(monitor.workspaceId, "checker"),
    input: { id: monitor.id, status },
  });
}

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

  const event = c.get("event");
  const monitorIdNumber = Number(monitorId);
  const privateLocationIdNumber = Number(privateLocationId);

  // Set event data for OTel/Axiom structured logging (matches cloud checker pattern)
  // Note: Private location pings are ingested to Tinybird separately via Go code in
  // apps/private-location/internal/tinybird/client.go, not through this event object
  const statusUpdate: Record<string, unknown> = {
    status: status,
    message: message,
    region: privateLocationId, // Private location ID as region string
    status_code: statusCode,
    cron_timestamp: cronTimestamp,
    latency_ms: latency,
    monitorId: monitorIdNumber,
  };
  if (event) event.status_update = statusUpdate;
  const recordIncidentError = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    statusUpdate.incident_error = errorMessage;
    return errorMessage;
  };

  try {
    const monitor = await db
      .select()
      .from(schema.monitor)
      .where(eq(schema.monitor.id, monitorIdNumber))
      .get();

    if (!monitor || monitor.deletedAt || !monitor.active) {
      return c.json({ success: true }, 200);
    }

    // checks cannot be stopped from here, so maintenance drops the failures a
    // check reported while it ran; a recovery always closes its outage
    const at = new Date(cronTimestamp);
    const activeMaintenance =
      status === "active"
        ? undefined
        : await db
            .select({ id: schema.monitor.id })
            .from(schema.monitor)
            .where(
              and(
                eq(schema.monitor.id, monitorIdNumber),
                or(
                  monitorInMaintenance(db, { at, mode: "pause" }),
                  monitorInWindow(db, at),
                ),
              ),
            )
            .get();

    if (activeMaintenance) {
      statusUpdate.maintenance_skipped = true;
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

    const { changed } = await recordPrivateLocationMonitorStatus({
      input: {
        monitorId: monitorIdNumber,
        privateLocationId: privateLocationIdNumber,
        status,
        cronTimestamp,
      },
    });

    if (!changed) {
      return c.json({ success: true }, 200);
    }

    const regions = [attachment.name];

    // Check if monitor has cloud regions
    const hasCloudRegions =
      monitor.regions && monitor.regions.trim().length > 0;

    // The status of a monitor without a workspace cannot be stored, and the
    // incident and notifications below are gated on it.
    if (!hasCloudRegions && monitor.workspaceId === null) {
      logger.warning("Private-only monitor has no workspace, report stored", {
        monitor_id: monitor.id,
      });
      statusUpdate.orphan_skipped = true;
      return c.json({ success: true }, 200);
    }

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
    const locationIds = allLocations
      .map((loc) => loc.id)
      .filter((id): id is number => id !== null);

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
      (affectedLocationCount >= numberOfLocations / 2 ||
        numberOfLocations === 1);

    statusUpdate.affected_location_count = affectedLocationCount;
    statusUpdate.location_count = numberOfLocations;
    statusUpdate.transition_applied =
      !hasCloudRegions && shouldTriggerIncident && monitor.status !== status;

    let incident = null;
    let triggeredNotifications: { notificationId: number; provider: string }[] =
      [];

    switch (status) {
      case "error":
        // Update monitor status for private-only monitors
        if (
          !hasCloudRegions &&
          shouldTriggerIncident &&
          monitor.status !== "error"
        ) {
          logger.info("Monitor status changed to error", {
            monitor_id: monitor.id,
            workspace_id: monitor.workspaceId,
          });
          await applyMonitorStatus(monitor, "error");
        }

        // Create incident only if private-only monitor AND threshold met
        if (shouldTriggerIncident) {
          try {
            const opened = await openIncident({
              monitorId: monitorIdNumber,
              workspaceId: monitor.workspaceId,
              cronTimestamp,
            });
            incident = opened.incident;
            if (opened.created && opened.incident) {
              await checkerAudit.publishAuditLog({
                id: `monitor:${monitorId}`,
                action: "incident.created",
                targets: [{ id: monitorId, type: "monitor" }],
                metadata: { cronTimestamp, incidentId: opened.incident.id },
              });
              logger.info("Created incident", {
                incident_id: opened.incident.id,
                monitor_id: monitorId,
                affected_location_count: affectedLocationCount,
                total_locations: numberOfLocations,
              });
            } else if (opened.incident) {
              logger.info("Already in incident", {
                incident_id: opened.incident.id,
              });
            }
          } catch (error) {
            logger.error("Failed to create incident", {
              monitor_id: monitorId,
              error_message: recordIncidentError(error),
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
        // Trigger notifications for cloud monitors always, private-only when threshold met AND status changed
        if (
          hasCloudRegions ||
          (shouldTriggerIncident && monitor.status !== "error")
        ) {
          triggeredNotifications = await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "alert",
            cronTimestamp,
            regions,
            latency,
            incidentId: incident?.id,
          });
        }
        break;
      case "degraded":
        // Update monitor status for private-only monitors
        if (
          !hasCloudRegions &&
          shouldTriggerIncident &&
          monitor.status !== "degraded"
        ) {
          logger.info("Monitor status changed to degraded", {
            monitor_id: monitor.id,
            workspace_id: monitor.workspaceId,
          });
          await applyMonitorStatus(monitor, "degraded");
        }

        // Resolve incident if private-only monitor AND threshold met
        if (shouldTriggerIncident) {
          try {
            const incidents = await resolveIncident({
              monitorId,
              workspaceId: monitor.workspaceId,
              cronTimestamp,
            });
            incident = incidents[0] ?? null;
          } catch (error) {
            logger.warning(
              "Failed to resolve incident on degraded transition",
              {
                monitor_id: monitorId,
                error_message: recordIncidentError(error),
              },
            );
            // Continue with notifications even if resolution fails
          }
        }

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
        // Trigger notifications for cloud monitors always, private-only when threshold met AND status changed
        if (
          hasCloudRegions ||
          (shouldTriggerIncident && monitor.status !== "degraded")
        ) {
          triggeredNotifications = await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "degraded",
            cronTimestamp,
            regions,
            latency,
            incidentId: incident?.id,
          });
        }
        break;
      case "active":
        // Update monitor status for private-only monitors
        if (
          !hasCloudRegions &&
          shouldTriggerIncident &&
          monitor.status !== "active"
        ) {
          logger.info("Monitor status changed to active", {
            monitor_id: monitor.id,
            workspace_id: monitor.workspaceId,
          });
          await applyMonitorStatus(monitor, "active");
        }

        // Resolve incident if private-only monitor AND threshold met
        if (shouldTriggerIncident) {
          try {
            const incidents = await resolveIncident({
              monitorId,
              workspaceId: monitor.workspaceId,
              cronTimestamp,
            });
            incident = incidents[0] ?? null;
          } catch (error) {
            logger.warning("Failed to resolve incident on active transition", {
              monitor_id: monitorId,
              error_message: recordIncidentError(error),
            });
            // Continue with notifications even if resolution fails
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
        // Trigger notifications for cloud monitors always, private-only when threshold met AND status changed
        if (
          hasCloudRegions ||
          (shouldTriggerIncident && monitor.status !== "active")
        ) {
          triggeredNotifications = await triggerNotifications({
            monitorId,
            statusCode,
            message,
            notifType: "recovery",
            cronTimestamp,
            regions,
            latency,
            incidentId: incident?.id,
          });
        }
        break;
    }

    // Add notification outcome to event for OTel logging
    statusUpdate.notificationTriggered = triggeredNotifications.length > 0;
    statusUpdate.notifications = triggeredNotifications;
    statusUpdate.incident_id = incident?.id ?? null;

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
