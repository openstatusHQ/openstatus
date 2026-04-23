import { eq } from "@openstatus/db";
import { maintenance } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, InternalServiceError } from "../errors";
import type { Maintenance } from "../types";
import {
  getMaintenanceInWorkspace,
  updatePageComponentAssociations,
  validatePageComponentIds,
} from "./internal";
import { UpdateMaintenanceInput } from "./schemas";

export async function updateMaintenance(args: {
  ctx: ServiceContext;
  input: UpdateMaintenanceInput;
}): Promise<Maintenance> {
  const { ctx } = args;
  const input = UpdateMaintenanceInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getMaintenanceInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    // Effective from/to for the range check — either the incoming value or
    // whatever was persisted before.
    const effectiveFrom = input.from ?? existing.from;
    const effectiveTo = input.to ?? existing.to;
    if (effectiveFrom >= effectiveTo) {
      throw new ConflictError("End date must be after start date.");
    }

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.message !== undefined) updateValues.message = input.message;
    if (input.from !== undefined) updateValues.from = input.from;
    if (input.to !== undefined) updateValues.to = input.to;

    if (input.pageComponentIds !== undefined) {
      const validated = await validatePageComponentIds({
        tx,
        workspaceId: ctx.workspace.id,
        pageComponentIds: input.pageComponentIds,
      });

      // `pageId` follows the association set: a new non-empty set moves
      // the maintenance to that page; an empty set nulls it. Matches the
      // pattern established on status-report update and what the Connect
      // `UpdateMaintenance` tests have encoded since the original handler.
      // Mixed-page inputs are rejected upstream by
      // `validatePageComponentIds` (all ids must share a page).
      updateValues.pageId = validated.pageId;

      await updatePageComponentAssociations({
        tx,
        maintenanceId: existing.id,
        componentIds: validated.componentIds,
      });
    }

    const updated = await tx
      .update(maintenance)
      .set(updateValues)
      .where(eq(maintenance.id, existing.id))
      .returning()
      .get();

    if (!updated) {
      throw new InternalServiceError(
        `failed to update maintenance ${existing.id}`,
      );
    }

    await emitAudit(tx, ctx, {
      action: "maintenance.update",
      entityType: "maintenance",
      entityId: updated.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
