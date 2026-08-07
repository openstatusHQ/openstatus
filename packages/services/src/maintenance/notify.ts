import { db as defaultDb, eq } from "@openstatus/db";
import { maintenance, maintenanceUpdate } from "@openstatus/db/src/schema";
import { dispatchMaintenanceUpdate } from "@openstatus/subscriptions";

import { requireScope } from "../auth";
import type { ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { NotifyMaintenanceInput } from "./schemas";

/**
 * Dispatch subscriber notifications for a specific maintenance update.
 * Separate from the
 * create/update mutations because the dashboard runs on Edge and cannot
 * fire-and-forget — callers invoke this as a second awaited call.
 *
 * Enforces:
 *   - Workspace owns the target update (via its parent maintenance).
 *   - Plan has `status-subscribers` enabled — otherwise no-op.
 */
export async function notifyMaintenance(args: {
  ctx: ServiceContext;
  input: NotifyMaintenanceInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = NotifyMaintenanceInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const row = await db
    .select({
      updateId: maintenanceUpdate.id,
      maintenanceWorkspaceId: maintenance.workspaceId,
    })
    .from(maintenanceUpdate)
    .innerJoin(maintenance, eq(maintenanceUpdate.maintenanceId, maintenance.id))
    .where(eq(maintenanceUpdate.id, input.maintenanceUpdateId))
    .get();

  if (!row) {
    throw new NotFoundError("maintenance_update", input.maintenanceUpdateId);
  }
  if (row.maintenanceWorkspaceId !== ctx.workspace.id) {
    throw new ForbiddenError(
      "Maintenance update does not belong to this workspace.",
    );
  }

  if (!ctx.workspace.limits["status-subscribers"]) {
    return;
  }

  await dispatchMaintenanceUpdate(input.maintenanceUpdateId);
}
