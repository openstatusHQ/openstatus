import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { NotFoundError } from "../errors";

export async function getMaintenanceWindowInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const row = await args.tx
    .select()
    .from(monitorMaintenanceWindow)
    .where(
      and(
        eq(monitorMaintenanceWindow.id, args.id),
        eq(monitorMaintenanceWindow.workspaceId, args.workspaceId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("maintenance_window", args.id);
  return row;
}

/** Dedupe and check workspace ownership; returns ids in input order. */
export async function validateWindowMonitorIds(args: {
  tx: DB;
  workspaceId: number;
  monitorIds: ReadonlyArray<number>;
}): Promise<number[]> {
  const ids = Array.from(new Set(args.monitorIds));
  const rows = await args.tx
    .select({ id: monitor.id })
    .from(monitor)
    .where(
      and(
        inArray(monitor.id, ids),
        eq(monitor.workspaceId, args.workspaceId),
        isNull(monitor.deletedAt),
      ),
    )
    .all();
  const found = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!found.has(id)) throw new NotFoundError("monitor", id);
  }
  return ids;
}

export async function replaceWindowMonitors(args: {
  tx: DB;
  windowId: number;
  monitorIds: ReadonlyArray<number>;
}) {
  await args.tx
    .delete(monitorMaintenanceWindowToMonitor)
    .where(
      eq(
        monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
        args.windowId,
      ),
    );
  await args.tx.insert(monitorMaintenanceWindowToMonitor).values(
    args.monitorIds.map((monitorId) => ({
      monitorMaintenanceWindowId: args.windowId,
      monitorId,
    })),
  );
}
