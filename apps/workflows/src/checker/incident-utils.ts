import { getLogger } from "@logtape/logtape";
import { and, db, eq, inArray, isNull, schema } from "@openstatus/db";

import { checkerAudit } from "../utils/audit-log";

const logger = getLogger(["workflow"]);

/**
 * Finds an open incident (not resolved) for the given monitor.
 */
export async function findOpenIncident(monitorId: number) {
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

/**
 * Finds all open incidents (not resolved) for the given monitor.
 */
export async function findAllOpenIncidents(monitorId: number) {
  return db
    .select()
    .from(schema.incidentTable)
    .where(
      and(
        eq(schema.incidentTable.monitorId, monitorId),
        isNull(schema.incidentTable.resolvedAt),
      ),
    )
    .all();
}

/**
 * Resolves all open incidents by setting resolvedAt and autoResolved flag.
 * Uses a single atomic bulk update to prevent partial state on failures.
 * Returns array of successfully resolved incidents.
 */
export async function resolveIncident(params: {
  monitorId: string;
  cronTimestamp: number;
}): Promise<(typeof schema.incidentTable.$inferSelect)[]> {
  const { monitorId, cronTimestamp } = params;

  // Find ALL open incidents for this monitor
  const incidents = await findAllOpenIncidents(Number(monitorId));

  if (incidents.length === 0) {
    return []; // No open incidents
  }

  // Extract all incident IDs for bulk update
  const incidentIds = incidents.map((i) => i.id);

  // ATOMIC BULK UPDATE: Resolve all incidents in a single query
  // This prevents partial state if operation fails midway
  const resolvedIncidents = await db
    .update(schema.incidentTable)
    .set({
      resolvedAt: new Date(cronTimestamp),
      autoResolved: true,
    })
    .where(
      and(
        inArray(schema.incidentTable.id, incidentIds),
        isNull(schema.incidentTable.resolvedAt), // Still prevents race conditions
      ),
    )
    .returning();

  // Emit audit logs for each resolved incident
  // These are best-effort; failure here doesn't affect data integrity
  for (const incident of resolvedIncidents) {
    logger.info("Recovered incident", {
      incident_id: incident.id,
      monitor_id: monitorId,
    });

    try {
      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "incident.resolved",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: { cronTimestamp, incidentId: incident.id },
      });
    } catch (error) {
      logger.error("Failed to publish audit log for incident resolution", {
        incident_id: incident.id,
        monitor_id: monitorId,
        error,
      });
      // Don't throw - incident is already resolved
    }
  }

  return resolvedIncidents;
}
