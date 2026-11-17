import { eq } from "@openstatus/db";
import {
  maintenance,
  monitorMaintenanceWindow,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import {
  assertNotDerived,
  getMaintenanceWindowInWorkspace,
} from "../maintenance-window/internal";
import type { Maintenance } from "../types";
import { getMaintenanceInWorkspace, syncDerivedWindow } from "./internal";
import {
  LinkMaintenanceWindowInput,
  UnlinkMaintenanceWindowInput,
} from "./schemas";

/** Announces an existing window: that window alone decides the checks, so the maintenance's derived window goes. */
export async function linkMaintenanceWindow(args: {
  ctx: ServiceContext;
  input: LinkMaintenanceWindowInput;
}): Promise<Maintenance> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = LinkMaintenanceWindowInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    if (
      existing.monitorMaintenanceWindowId === input.monitorMaintenanceWindowId
    ) {
      return existing;
    }
    const window = await getMaintenanceWindowInWorkspace({
      tx,
      id: input.monitorMaintenanceWindowId,
      workspaceId: ctx.workspace.id,
    });
    await assertNotDerived(tx, window);

    await tx
      .update(maintenance)
      .set({
        monitorMaintenanceWindowId: window.id,
        updatedAt: new Date(),
        updatedBy: tryGetActorUserId(ctx.actor),
      })
      .where(eq(maintenance.id, existing.id));
    await syncDerivedWindow(tx, ctx, existing.id);
    const updated = await getMaintenanceInWorkspace({
      tx,
      id: existing.id,
      workspaceId: ctx.workspace.id,
    });
    await emitAudit(tx, ctx, {
      action: "maintenance.update",
      entityType: "maintenance",
      entityId: existing.id,
      before: existing,
      after: updated,
    });
    return updated;
  });
}

/** Stops announcing a user window; the monitors behind its components, if any, pause through a derived window again. */
export async function unlinkMaintenanceWindow(args: {
  ctx: ServiceContext;
  input: UnlinkMaintenanceWindowInput;
}): Promise<Maintenance> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = UnlinkMaintenanceWindowInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    if (existing.monitorMaintenanceWindowId === null) return existing;
    const derived = await tx
      .select({ id: monitorMaintenanceWindow.id })
      .from(monitorMaintenanceWindow)
      .where(eq(monitorMaintenanceWindow.maintenanceId, existing.id))
      .get();
    if (derived?.id === existing.monitorMaintenanceWindowId) return existing;

    await tx
      .update(maintenance)
      .set({
        monitorMaintenanceWindowId: null,
        updatedAt: new Date(),
        updatedBy: tryGetActorUserId(ctx.actor),
      })
      .where(eq(maintenance.id, existing.id));
    await syncDerivedWindow(tx, ctx, existing.id);
    const updated = await getMaintenanceInWorkspace({
      tx,
      id: existing.id,
      workspaceId: ctx.workspace.id,
    });
    await emitAudit(tx, ctx, {
      action: "maintenance.update",
      entityType: "maintenance",
      entityId: existing.id,
      before: existing,
      after: updated,
    });
    return updated;
  });
}
