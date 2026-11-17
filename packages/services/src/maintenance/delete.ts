import { eq } from "@openstatus/db";
import {
  maintenance,
  monitorMaintenanceWindow,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { monitorIdsOf } from "../maintenance-window/internal";
import { getMaintenanceInWorkspace } from "./internal";
import { DeleteMaintenanceInput } from "./schemas";

/** Delete a maintenance row. Cascade removes `maintenances_to_page_components` and its derived window. */
export async function deleteMaintenance(args: {
  ctx: ServiceContext;
  input: DeleteMaintenanceInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "incidents:write");
  const input = DeleteMaintenanceInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const derived = await tx
      .select()
      .from(monitorMaintenanceWindow)
      .where(eq(monitorMaintenanceWindow.maintenanceId, existing.id))
      .get();
    const derivedMonitorIds = derived ? await monitorIdsOf(tx, derived.id) : [];

    await tx.delete(maintenance).where(eq(maintenance.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "maintenance.delete",
      entityType: "maintenance",
      entityId: existing.id,
      before: existing,
    });
    if (derived) {
      await emitAudit(tx, ctx, {
        action: "monitor_maintenance_window.delete",
        entityType: "monitor_maintenance_window",
        entityId: derived.id,
        before: { ...derived, monitorIds: derivedMonitorIds },
      });
    }
  });
}
