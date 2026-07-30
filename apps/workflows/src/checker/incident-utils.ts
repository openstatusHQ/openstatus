import { getLogger } from "@logtape/logtape";
import { and, db, eq, isNull, schema } from "@openstatus/db";

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
 * Uses atomic conditional updates to prevent race conditions from concurrent recoveries.
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

  const resolved: (typeof schema.incidentTable.$inferSelect)[] = [];

  // Resolve each incident atomically with proper logging
  for (const incident of incidents) {
    const [updated] = await db
      .update(schema.incidentTable)
      .set({
        resolvedAt: new Date(cronTimestamp),
        autoResolved: true,
      })
      .where(
        and(
          eq(schema.incidentTable.id, incident.id),
          isNull(schema.incidentTable.resolvedAt), // Still atomic
        ),
      )
      .returning();

    if (updated) {
      logger.info("Recovered incident", {
        incident_id: updated.id,
        monitor_id: monitorId,
      });

      await checkerAudit.publishAuditLog({
        id: `monitor:${monitorId}`,
        action: "incident.resolved",
        targets: [{ id: monitorId, type: "monitor" }],
        metadata: { cronTimestamp, incidentId: updated.id },
      });

      resolved.push(updated);
    }
  }

  return resolved;
}
