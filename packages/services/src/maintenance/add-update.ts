import { maintenanceUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { InternalServiceError } from "../errors";
import type { Maintenance, MaintenanceUpdate } from "../types";
import { getMaintenanceInWorkspace, syncMaintenanceMessage } from "./internal";
import { AddMaintenanceUpdateInput } from "./schemas";

export type AddMaintenanceUpdateResult = {
  maintenance: Maintenance;
  maintenanceUpdate: MaintenanceUpdate;
};

export async function addMaintenanceUpdate(args: {
  ctx: ServiceContext;
  input: AddMaintenanceUpdateInput;
}): Promise<AddMaintenanceUpdateResult> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = AddMaintenanceUpdateInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const record = await getMaintenanceInWorkspace({
      tx,
      id: input.maintenanceId,
      workspaceId: ctx.workspace.id,
    });

    const newUpdate = await tx
      .insert(maintenanceUpdate)
      .values({
        maintenanceId: record.id,
        message: input.message,
        date: input.date ?? new Date(),
      })
      .returning()
      .get();

    const updatedMaintenance = await syncMaintenanceMessage(tx, record.id);
    if (!updatedMaintenance) {
      throw new InternalServiceError(
        `failed to synchronize maintenance ${record.id}`,
      );
    }

    await emitAudit(tx, ctx, {
      action: "maintenance_update.create",
      entityType: "maintenance_update",
      entityId: newUpdate.id,
      after: newUpdate,
      metadata: { maintenanceId: record.id },
    });

    return {
      maintenance: updatedMaintenance,
      maintenanceUpdate: newUpdate,
    };
  });
}
