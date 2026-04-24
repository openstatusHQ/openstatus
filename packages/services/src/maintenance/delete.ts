import { eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { getMaintenanceInWorkspace } from "./internal";
import { DeleteMaintenanceInput } from "./schemas";

/** Delete a maintenance row. Cascade removes `maintenances_to_page_components`. */
export async function deleteMaintenance(args: {
  ctx: ServiceContext;
  input: DeleteMaintenanceInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteMaintenanceInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx.delete(maintenance).where(eq(maintenance.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "maintenance.delete",
      entityType: "maintenance",
      entityId: existing.id,
      before: existing,
    });
  });
}
