import { and, eq, inArray, isNull } from "@openstatus/db";
import { monitorIncidentTable } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import type { DB, ServiceContext } from "../context";
import { NotFoundError } from "../errors";
import type { MonitorIncident } from "../types";

/** Load an incident by id, scoped to the workspace. Throws on miss. */
export async function getMonitorIncidentInWorkspace(args: {
  tx: DB;
  id: number;
  workspaceId: number;
}) {
  const { tx, id, workspaceId } = args;
  const row = await tx
    .select()
    .from(monitorIncidentTable)
    .where(
      and(
        eq(monitorIncidentTable.id, id),
        eq(monitorIncidentTable.workspaceId, workspaceId),
      ),
    )
    .get();
  if (!row) throw new NotFoundError("incident", id);
  return row;
}

/**
 * Auto-resolve the open outages of monitors that stop being checked (paused or
 * deleted); otherwise they stay open and count as downtime until today.
 */
export async function resolveOpenMonitorIncidents(args: {
  tx: DB;
  ctx: ServiceContext;
  monitorIds: number[];
  now?: Date;
}): Promise<MonitorIncident[]> {
  const { tx, ctx, monitorIds, now = new Date() } = args;
  if (monitorIds.length === 0) return [];

  const where = and(
    eq(monitorIncidentTable.workspaceId, ctx.workspace.id),
    inArray(monitorIncidentTable.monitorId, monitorIds),
    isNull(monitorIncidentTable.resolvedAt),
  );
  const open = await tx.select().from(monitorIncidentTable).where(where).all();
  if (open.length === 0) return [];

  const resolved = await tx
    .update(monitorIncidentTable)
    .set({
      resolvedAt: now,
      resolvedBy: null,
      autoResolved: true,
      updatedAt: now,
    })
    .where(where)
    .returning()
    .all();

  const before = new Map(open.map((r) => [r.id, r]));
  for (const after of resolved) {
    const prior = before.get(after.id);
    if (!prior) continue;
    await emitAudit(tx, ctx, {
      action: "monitor_incident.update",
      entityType: "monitor_incident",
      entityId: after.id,
      before: prior,
      after,
    });
  }
  return resolved;
}
