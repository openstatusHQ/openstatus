import { eq } from "@openstatus/db";
import { maintenance, maintenanceUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import type { MaintenanceUpdate } from "../types";
import { getMaintenanceInWorkspace } from "./internal";
import { AddMaintenanceUpdateInput } from "./schemas";

export async function addMaintenanceUpdate(args: {
  ctx: ServiceContext;
  input: AddMaintenanceUpdateInput;
}): Promise<MaintenanceUpdate> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = AddMaintenanceUpdateInput.parse(args.input);
  const actorUserId = tryGetActorUserId(ctx.actor);

  return withTransaction(ctx, async (tx) => {
    const record = await getMaintenanceInWorkspace({
      tx,
      id: input.maintenanceId,
      workspaceId: ctx.workspace.id,
    });

    const created = await tx
      .insert(maintenanceUpdate)
      .values({
        maintenanceId: record.id,
        message: input.message,
        date: input.date ?? new Date(),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning()
      .get();

    await touchMaintenance(tx, record.id, actorUserId);

    await emitAudit(tx, ctx, {
      action: "maintenance_update.create",
      entityType: "maintenance_update",
      entityId: created.id,
      after: created,
      metadata: { maintenanceId: record.id },
    });

    return created;
  });
}

/** Timeline writes bump the parent so feeds and caches see a change. */
export async function touchMaintenance(
  tx: Parameters<Parameters<typeof withTransaction>[1]>[0],
  maintenanceId: number,
  actorUserId: number | null,
): Promise<void> {
  await tx
    .update(maintenance)
    .set({ updatedAt: new Date(), updatedBy: actorUserId })
    .where(eq(maintenance.id, maintenanceId));
}
