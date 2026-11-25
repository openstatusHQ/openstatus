import { getLogger } from "@logtape/logtape";
import {
  autoResolveMonitorIncidents,
  listRecoveredMonitorsWithOpenIncidents,
} from "@openstatus/services/monitor-incident";
import { Hono } from "hono";

import { env } from "../env";
import { systemContext } from "../utils/system-context";

const logger = getLogger(["workflow"]);

export const incidentRoute = new Hono({ strict: false });

incidentRoute.use("*", async (c, next) => {
  if (c.req.header("authorization") !== env().CRON_SECRET) {
    return c.text("Unauthorized", 401);
  }

  return next();
});

incidentRoute.get("/cleanup", async (c) => {
  const updated = await resolveStaleIncidents();
  return c.json({ status: "ok", updated });
});

/**
 * Auto-resolves incidents left open on monitors that are up again. Returns how
 * many closed. `workspaceId` narrows the sweep; the cron runs it for everyone.
 */
export async function resolveStaleIncidents(
  workspaceId?: number,
): Promise<number> {
  const monitors = await listRecoveredMonitorsWithOpenIncidents({
    workspaceId,
  });

  let updated = 0;
  for (const monitor of monitors) {
    // One monitor per transaction, so a failure leaves the rest resolved.
    try {
      const resolved = await autoResolveMonitorIncidents({
        ctx: await systemContext(monitor.workspaceId, "incident-cleanup"),
        input: { monitorId: monitor.id },
      });
      updated += resolved.length;
    } catch (error) {
      logger.warn("Failed to auto-resolve incidents in cleanup", {
        monitor_id: monitor.id,
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return updated;
}
