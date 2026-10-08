import { db as defaultDb, eq } from "@openstatus/db";
import { maintenance, maintenanceUpdate } from "@openstatus/db/src/schema";
import { dispatchMaintenanceUpdate } from "@openstatus/subscriptions";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { NotifyMaintenanceUpdateInput } from "./schemas";

/**
 * Dispatch subscriber notifications for one timeline entry. Same contract as
 * `notifyMaintenance`: a second awaited call, gated on `status-subscribers`.
 * Returns true only when a dispatch actually ran.
 */
export async function notifyMaintenanceUpdate(args: {
  ctx: ServiceContext;
  input: NotifyMaintenanceUpdateInput;
}): Promise<boolean> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = NotifyMaintenanceUpdateInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const row = await db
    .select({ workspaceId: maintenance.workspaceId })
    .from(maintenanceUpdate)
    .innerJoin(maintenance, eq(maintenanceUpdate.maintenanceId, maintenance.id))
    .where(eq(maintenanceUpdate.id, input.maintenanceUpdateId))
    .get();

  if (!row) {
    throw new NotFoundError("maintenance_update", input.maintenanceUpdateId);
  }
  if (row.workspaceId !== ctx.workspace.id) {
    throw new ForbiddenError(
      "Maintenance update does not belong to this workspace.",
    );
  }

  if (!ctx.workspace.limits["status-subscribers"]) {
    return false;
  }

  await dispatchMaintenanceUpdate(input.maintenanceUpdateId);
  return true;
}
