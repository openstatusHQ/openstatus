import { db as defaultDb, eq } from "@openstatus/db";
import { maintenance, maintenanceUpdate } from "@openstatus/db/src/schema";
import { dispatchMaintenanceUpdate } from "@openstatus/subscriptions";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { NotifyMaintenanceInput } from "./schemas";

/**
 * Dispatch subscriber notifications for one timeline entry (the announcement
 * is the first update). Separate from the mutations because the dashboard
 * runs on Edge and cannot fire-and-forget — callers invoke this as a second
 * awaited call, mirroring `notifyStatusReport`.
 *
 * Enforces:
 *   - Workspace owns the target update (via join to the parent maintenance).
 *   - Plan has `status-subscribers` enabled — otherwise no-op.
 *
 * Returns true only when a dispatch actually ran.
 */
export async function notifyMaintenance(args: {
  ctx: ServiceContext;
  input: NotifyMaintenanceInput;
}): Promise<boolean> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = NotifyMaintenanceInput.parse(args.input);
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
