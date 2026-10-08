import { eq } from "@openstatus/db";
import { maintenanceUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { touchMaintenance } from "./add-update";
import { getMaintenanceUpdateInWorkspace } from "./internal";
import { DeleteMaintenanceUpdateInput } from "./schemas";

export async function deleteMaintenanceUpdate(args: {
  ctx: ServiceContext;
  input: DeleteMaintenanceUpdateInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DeleteMaintenanceUpdateInput.parse(args.input);
  const actorUserId = tryGetActorUserId(ctx.actor);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceUpdateInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx
      .delete(maintenanceUpdate)
      .where(eq(maintenanceUpdate.id, existing.id));
    await touchMaintenance(tx, existing.maintenanceId, actorUserId);

    await emitAudit(tx, ctx, {
      action: "maintenance_update.delete",
      entityType: "maintenance_update",
      entityId: existing.id,
      before: existing,
      metadata: { maintenanceId: existing.maintenanceId },
    });
  });
}
