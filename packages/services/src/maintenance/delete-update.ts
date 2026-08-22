import { count, eq } from "@openstatus/db";
import { maintenanceUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError } from "../errors";
import {
  getMaintenanceUpdateInWorkspace,
  syncMaintenanceMessage,
} from "./internal";
import { DeleteMaintenanceUpdateInput } from "./schemas";

export async function deleteMaintenanceUpdate(args: {
  ctx: ServiceContext;
  input: DeleteMaintenanceUpdateInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DeleteMaintenanceUpdateInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceUpdateInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    const total = await tx
      .select({ value: count() })
      .from(maintenanceUpdate)
      .where(eq(maintenanceUpdate.maintenanceId, existing.maintenanceId))
      .get();
    if ((total?.value ?? 0) <= 1) {
      throw new ConflictError("A maintenance must have at least one update.");
    }

    await tx
      .delete(maintenanceUpdate)
      .where(eq(maintenanceUpdate.id, existing.id));
    await syncMaintenanceMessage(tx, existing.maintenanceId);

    await emitAudit(tx, ctx, {
      action: "maintenance_update.delete",
      entityType: "maintenance_update",
      entityId: existing.id,
      before: existing,
      metadata: { maintenanceId: existing.maintenanceId },
    });
  });
}
