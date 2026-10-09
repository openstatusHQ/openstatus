import { eq } from "@openstatus/db";
import { maintenanceUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { InternalServiceError } from "../errors";
import type { MaintenanceUpdate } from "../types";
import { touchMaintenance } from "./add-update";
import { getMaintenanceUpdateInWorkspace } from "./internal";
import { UpdateMaintenanceUpdateInput } from "./schemas";

export async function updateMaintenanceUpdate(args: {
  ctx: ServiceContext;
  input: UpdateMaintenanceUpdateInput;
}): Promise<MaintenanceUpdate> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdateMaintenanceUpdateInput.parse(args.input);
  const actorUserId = tryGetActorUserId(ctx.actor);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceUpdateInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const values: Partial<MaintenanceUpdate> = {
      updatedAt: new Date(),
      updatedBy: actorUserId,
    };
    if (input.message !== undefined) values.message = input.message;
    if (input.date !== undefined) values.date = input.date;

    const updated = await tx
      .update(maintenanceUpdate)
      .set(values)
      .where(eq(maintenanceUpdate.id, existing.id))
      .returning()
      .get();
    if (!updated) {
      throw new InternalServiceError(
        `failed to update maintenance update ${existing.id}`,
      );
    }

    await touchMaintenance(tx, existing.maintenanceId, actorUserId);

    await emitAudit(tx, ctx, {
      action: "maintenance_update.update",
      entityType: "maintenance_update",
      entityId: updated.id,
      before: existing,
      after: updated,
      metadata: { maintenanceId: existing.maintenanceId },
    });

    return updated;
  });
}
