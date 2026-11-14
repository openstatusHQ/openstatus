import { eq } from "@openstatus/db";
import { monitorMaintenanceWindow } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getMaintenanceWindowInWorkspace } from "./internal";
import { DeleteMaintenanceWindowInput } from "./schemas";

/** Cascade removes the monitor links; excused windows keep their times, the link is nulled. */
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
    await tx
      .delete(monitorMaintenanceWindow)
      .where(eq(monitorMaintenanceWindow.id, existing.id));
    await emitAudit(tx, ctx, {
      action: "monitor_maintenance_window.delete",
      entityType: "monitor_maintenance_window",
      entityId: existing.id,
      before: existing,
    });
  });
}
