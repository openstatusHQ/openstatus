import { monitorMaintenanceWindow } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { replaceWindowMonitors, validateWindowMonitorIds } from "./internal";
import { CreateMaintenanceWindowInput } from "./schemas";

export async function createMaintenanceWindow(args: {
  ctx: ServiceContext;
  input: CreateMaintenanceWindowInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "monitors:write");
  const input = CreateMaintenanceWindowInput.parse(args.input);
  const actorUserId = tryGetActorUserId(ctx.actor);

  return withTransaction(ctx, async (tx) => {
    const monitorIds = await validateWindowMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: input.monitorIds,
    });
    const row = await tx
      .insert(monitorMaintenanceWindow)
      .values({
        workspaceId: ctx.workspace.id,
        title: input.title,
        mode: input.mode,
        from: input.from,
        to: input.to,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning()
      .get();
    await replaceWindowMonitors({ tx, windowId: row.id, monitorIds });
    await emitAudit(tx, ctx, {
      action: "monitor_maintenance_window.create",
      entityType: "monitor_maintenance_window",
      entityId: row.id,
      after: { ...row, monitorIds },
    });
    return row;
  });
}
