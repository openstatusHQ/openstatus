import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { GetPrivateLocationIdsByMonitorInput } from "./schemas";

/**
 * Map each monitor id to the ids of the private locations that run it, in one
 * batched workspace-scoped query. Monitors with no associations are absent from
 * the map (callers default to `[]`).
 */
export async function getPrivateLocationIdsByMonitor(args: {
  ctx: ServiceContext;
  input: GetPrivateLocationIdsByMonitorInput;
}): Promise<Map<number, string[]>> {
  const input = GetPrivateLocationIdsByMonitorInput.parse(args.input);
  const db = getReadDb(args.ctx);

  const map = new Map<number, string[]>();
  const ids = Array.from(new Set(input.monitorIds));
  if (ids.length === 0) return map;

  const rows = await db
    .select({
      monitorId: privateLocationToMonitors.monitorId,
      privateLocationId: privateLocationToMonitors.privateLocationId,
    })
    .from(privateLocationToMonitors)
    .innerJoin(
      privateLocation,
      eq(privateLocationToMonitors.privateLocationId, privateLocation.id),
    )
    .innerJoin(monitor, eq(privateLocationToMonitors.monitorId, monitor.id))
    .where(
      and(
        inArray(privateLocationToMonitors.monitorId, ids),
        // Scope both sides to the workspace so a legacy/corrupt pivot row can't
        // surface a foreign private location or monitor.
        eq(privateLocation.workspaceId, args.ctx.workspace.id),
        eq(monitor.workspaceId, args.ctx.workspace.id),
        // Match the checker/monitor reads: a soft-deleted attachment or monitor
        // no longer runs the monitor.
        isNull(privateLocationToMonitors.deletedAt),
        isNull(monitor.deletedAt),
      ),
    )
    .all();

  for (const row of rows) {
    if (row.monitorId == null || row.privateLocationId == null) continue;
    const arr = map.get(row.monitorId) ?? [];
    arr.push(String(row.privateLocationId));
    map.set(row.monitorId, arr);
  }

  map.forEach((arr) => arr.sort((a, b) => Number(a) - Number(b)));

  return map;
}
