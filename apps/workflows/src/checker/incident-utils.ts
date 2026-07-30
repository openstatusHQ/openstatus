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
 * Resolves an open incident by setting resolvedAt and autoResolved flag.
 * Uses a conditional update to prevent race conditions from concurrent recoveries.
 * Returns the incident if successfully resolved, null if no incident or already resolved.
 */
export async function resolveIncident(params: {
  monitorId: string;
  cronTimestamp: number;
}): Promise<typeof schema.incidentTable.$inferSelect | null> {
  const { monitorId, cronTimestamp } = params;

  // First, find the single open incident for this monitor
  const incident = await findOpenIncident(Number(monitorId));

  if (!incident) {
    return null; // No open incident
  }

  // Atomic conditional update scoped to this specific incident
  // Only succeeds if resolvedAt is still NULL (prevents race conditions)
  const [updated] = await db
    .update(schema.incidentTable)
    .set({
      resolvedAt: new Date(cronTimestamp),
      autoResolved: true,
    })
    .where(
      and(
        eq(schema.incidentTable.id, incident.id),
        isNull(schema.incidentTable.resolvedAt),
      ),
    )
    .returning();

  if (!updated) {
    return null; // Already resolved or no incident
  }

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

  return updated;
}
