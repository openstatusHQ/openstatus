import { eq } from "@openstatus/db";
import { monitorMaintenanceWindow } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError } from "../errors";
import {
  getMaintenanceWindowInWorkspace,
  monitorIdsOf,
  replaceWindowMonitors,
  syncLinkedMaintenances,
  validateWindowMonitorIds,
} from "./internal";
import {
  EndMaintenanceWindowInput,
  UpdateMaintenanceWindowInput,
} from "./schemas";

export async function updateMaintenanceWindow(args: {
  ctx: ServiceContext;
  input: UpdateMaintenanceWindowInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = UpdateMaintenanceWindowInput.parse(args.input);
  const actorUserId = tryGetActorUserId(ctx.actor);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceWindowInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    const from = input.from ?? existing.from;
    const to = input.to ?? existing.to;
    if (from >= to)
      throw new ConflictError("End date must be after start date.");

    const beforeIds = await monitorIdsOf(tx, existing.id);
    let afterIds = beforeIds;
    if (input.monitorIds !== undefined) {
      afterIds = await validateWindowMonitorIds({
        tx,
        workspaceId: ctx.workspace.id,
        monitorIds: input.monitorIds,
      });
      await replaceWindowMonitors({
        tx,
        windowId: existing.id,
        monitorIds: afterIds,
      });
    }

    const updated = await tx
      .update(monitorMaintenanceWindow)
      .set({
        title: input.title ?? existing.title,
        mode: input.mode ?? existing.mode,
        from,
        to,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(monitorMaintenanceWindow.id, existing.id))
      .returning()
      .get();
    await syncLinkedMaintenances(tx, updated);
    await emitAudit(tx, ctx, {
      action: "monitor_maintenance_window.update",
      entityType: "monitor_maintenance_window",
      entityId: updated.id,
      before: { ...existing, monitorIds: beforeIds },
      after: { ...updated, monitorIds: afterIds },
    });
    return updated;
  });
}

/** Ends a running window now; a window that has not started or already ended is refused. */
export async function endMaintenanceWindow(args: {
  ctx: ServiceContext;
  input: EndMaintenanceWindowInput;
  now?: Date;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = EndMaintenanceWindowInput.parse(args.input);
  const now = args.now ?? new Date();

  return withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceWindowInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    // from === now would leave an empty [from, to) range
    if (existing.from >= now || existing.to <= now) {
      throw new ConflictError(
        "Only a running maintenance window can be ended.",
      );
    }
    const updated = await tx
      .update(monitorMaintenanceWindow)
      .set({
        to: now,
        updatedBy: tryGetActorUserId(ctx.actor),
        updatedAt: now,
      })
      .where(eq(monitorMaintenanceWindow.id, existing.id))
      .returning()
      .get();
    await syncLinkedMaintenances(tx, updated);
    await emitAudit(tx, ctx, {
      action: "monitor_maintenance_window.update",
      entityType: "monitor_maintenance_window",
      entityId: updated.id,
      before: existing,
      after: updated,
    });
    return updated;
  });
}
