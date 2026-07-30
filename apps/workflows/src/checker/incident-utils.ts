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

  // Conditional update: only update if resolvedAt IS NULL
  // This prevents concurrent recoveries from both succeeding
  const [updated] = await db
    .update(schema.incidentTable)
    .set({
      resolvedAt: new Date(cronTimestamp),
      autoResolved: true,
    })
    .where(
      and(
        eq(schema.incidentTable.monitorId, Number(monitorId)),
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
    id: monitor:,
    action: "incident.resolved",
    targets: [{ id: monitorId, type: "monitor" }],
    metadata: { cronTimestamp, incidentId: updated.id },
  });

  return updated;
}
