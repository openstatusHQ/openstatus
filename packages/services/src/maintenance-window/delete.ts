import { eq } from "@openstatus/db";
import { monitorMaintenanceWindow } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getMaintenanceWindowInWorkspace, monitorIdsOf } from "./internal";
import { DeleteMaintenanceWindowInput } from "./schemas";

export async function deleteMaintenanceWindow(args: {
  ctx: ServiceContext;
  input: DeleteMaintenanceWindowInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = DeleteMaintenanceWindowInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceWindowInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });
    const monitorIds = await monitorIdsOf(tx, existing.id);
    await tx
      .delete(monitorMaintenanceWindow)
      .where(eq(monitorMaintenanceWindow.id, existing.id));
    await emitAudit(tx, ctx, {
      action: "monitor_maintenance_window.delete",
      entityType: "monitor_maintenance_window",
      entityId: existing.id,
      before: { ...existing, monitorIds },
    });
  });
}
