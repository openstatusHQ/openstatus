import { getLogger } from "@logtape/logtape";
import type { monitorIncidentTable } from "@openstatus/db/src/schema";
import { ConflictError } from "@openstatus/services";
import {
  autoResolveMonitorIncidents,
  createMonitorIncident,
  findOpenMonitorIncident,
} from "@openstatus/services/monitor-incident";

import { checkerAudit } from "../utils/audit-log";
import { systemContext } from "../utils/system-context";

const logger = getLogger(["workflow"]);

type MonitorIncident = typeof monitorIncidentTable.$inferSelect;

/** Opens an incident, or returns the one already open (`created: false`). */
export async function openIncident(params: {
  monitorId: number;
  workspaceId: number | null;
  cronTimestamp: number;
}): Promise<{ incident: MonitorIncident | null; created: boolean }> {
  const { monitorId, workspaceId, cronTimestamp } = params;
  const ctx = await systemContext(workspaceId, "checker");
  try {
    const incident = await createMonitorIncident({
      ctx,
      input: { monitorId, startedAt: new Date(cronTimestamp) },
    });
    return { incident, created: true };
  } catch (error) {
    if (!(error instanceof ConflictError)) throw error;
    const incident = await findOpenMonitorIncident({ monitorId });
    return { incident: incident ?? null, created: false };
  }
}

/** Auto-resolves the monitor's open incidents and returns them. */
export async function resolveIncident(params: {
  monitorId: string;
  workspaceId: number | null;
  cronTimestamp: number;
}): Promise<MonitorIncident[]> {
  const { monitorId, workspaceId, cronTimestamp } = params;

  const resolvedIncidents = await autoResolveMonitorIncidents({
    ctx: await systemContext(workspaceId, "checker"),
    input: {
      monitorId: Number(monitorId),
      resolvedAt: new Date(cronTimestamp),
    },
  });

  for (const incident of resolvedIncidents) {
    logger.info("Recovered incident", {
      incident_id: incident.id,
      monitor_id: monitorId,
    });

    // Best-effort: the Tinybird trail is not the record, the incident is resolved.
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
    }
  }

  return resolvedIncidents;
}
