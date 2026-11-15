import { eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import type { Maintenance } from "../types";
import { getMaintenanceInWorkspace } from "./internal";
import { UnlinkMaintenanceWindowInput } from "./schemas";

/** Detaches a maintenance from its window; it then pauses the monitors behind its components. */
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

    const updated = await tx
      .update(maintenance)
      .set({
        monitorMaintenanceWindowId: null,
        updatedAt: new Date(),
        updatedBy: tryGetActorUserId(ctx.actor),
      })
      .where(eq(maintenance.id, existing.id))
      .returning()
      .get();
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
