import { and, asc, eq, inArray, isNull } from "@openstatus/db";
import {
  maintenance,
  monitor,
  monitorMaintenanceWindow,
  monitorMaintenanceWindowToMonitor,
} from "@openstatus/db/src/schema";

import type { DB } from "../context";
import { NotFoundError, PreconditionFailedError } from "../errors";

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
  // sorted like monitorIdsOf, so audit diffs ignore request order
  const ids = Array.from(new Set(args.monitorIds)).sort((a, b) => a - b);
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

export async function monitorIdsOf(tx: DB, windowId: number) {
  const rows = await tx
    .select({ id: monitorMaintenanceWindowToMonitor.monitorId })
    .from(monitorMaintenanceWindowToMonitor)
    .where(
      eq(
        monitorMaintenanceWindowToMonitor.monitorMaintenanceWindowId,
        windowId,
      ),
    )
    .orderBy(asc(monitorMaintenanceWindowToMonitor.monitorId))
    .all();
  return rows.map((r) => r.id);
}

/** Linked status-page maintenances follow their window's times; editing one never re-notifies. */
export async function syncLinkedMaintenances(
  tx: DB,
  window: { id: number; from: Date; to: Date },
): Promise<void> {
  await tx
    .update(maintenance)
    .set({ from: window.from, to: window.to, updatedAt: new Date() })
    .where(eq(maintenance.monitorMaintenanceWindowId, window.id));
}

/** A window cannot be deleted while a status-page maintenance announces it. */
export async function assertNoLinkedMaintenances(
  tx: DB,
  windowId: number,
): Promise<void> {
  const linked = await tx
    .select({ id: maintenance.id, title: maintenance.title })
    .from(maintenance)
    .where(eq(maintenance.monitorMaintenanceWindowId, windowId))
    .all();
  if (linked.length === 0) return;
  throw new PreconditionFailedError(
    `This window is announced by ${linked.map((m) => `"${m.title}"`).join(", ")}. Unlink or delete the announcement first.`,
  );
}
