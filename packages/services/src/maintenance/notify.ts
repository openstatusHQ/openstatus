import { db as defaultDb, eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";
import { dispatchMaintenanceUpdate } from "@openstatus/subscriptions";

import type { ServiceContext } from "../context";
import { ForbiddenError, NotFoundError } from "../errors";
import { NotifyMaintenanceInput } from "./schemas";

/**
 * Dispatch subscriber notifications for a maintenance. Separate from the
 * create/update mutations because the dashboard runs on Edge and cannot
 * fire-and-forget — callers invoke this as a second awaited call.
 *
 * Enforces:
 *   - Workspace owns the target maintenance.
 *   - Plan has `status-subscribers` enabled — otherwise no-op.
 */
export async function notifyMaintenance(args: {
  ctx: ServiceContext;
  input: NotifyMaintenanceInput;
}): Promise<void> {
  const { ctx } = args;
  const input = NotifyMaintenanceInput.parse(args.input);
  const db = ctx.db ?? defaultDb;

  const row = await db
    .select({ id: maintenance.id, workspaceId: maintenance.workspaceId })
    .from(maintenance)
    .where(eq(maintenance.id, input.maintenanceId))
    .get();

  if (!row) {
    throw new NotFoundError("maintenance", input.maintenanceId);
  }
  if (row.workspaceId !== ctx.workspace.id) {
    throw new ForbiddenError("Maintenance does not belong to this workspace.");
  }

  if (!ctx.workspace.limits["status-subscribers"]) {
    return;
  }

  await dispatchMaintenanceUpdate(input.maintenanceId);
}
