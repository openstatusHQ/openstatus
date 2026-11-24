import { and, db as defaultDb, eq, inArray, isNull, ne } from "@openstatus/db";
import { monitor, monitorIncidentTable } from "@openstatus/db/src/schema";

import type { DB } from "../context";

/**
 * Active monitors that are up again but still have an open incident, across
 * workspaces unless `workspaceId` narrows it. Feeds the cleanup sweep.
 */
export async function listRecoveredMonitorsWithOpenIncidents(
  args: { workspaceId?: number; db?: DB } = {},
): Promise<{ id: number; workspaceId: number | null }[]> {
  const db = args.db ?? defaultDb;
  const openIncidentMonitorIds = db
    .select({ monitorId: monitorIncidentTable.monitorId })
    .from(monitorIncidentTable)
    .where(isNull(monitorIncidentTable.resolvedAt));

  return db
    .select({ id: monitor.id, workspaceId: monitor.workspaceId })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, openIncidentMonitorIds),
        eq(monitor.active, true),
        ne(monitor.status, "error"),
        args.workspaceId === undefined
          ? undefined
          : eq(monitor.workspaceId, args.workspaceId),
      ),
    )
    .all();
}
