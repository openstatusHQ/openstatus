import { desc, eq } from "@openstatus/db";
import { maintenance, maintenanceUpdate } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type DB,
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
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
  requireScope(ctx, "write");
  const input = UpdateMaintenanceInput.parse(args.input);
  const actorUserId = tryGetActorUserId(ctx.actor);

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

    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: actorUserId,
    };
    if (input.title !== undefined) updateValues.title = input.title;
    if (input.from !== undefined) updateValues.from = input.from;
    if (input.to !== undefined) updateValues.to = input.to;

    if (input.pageComponentIds !== undefined) {
      const validated = await validatePageComponentIds({
        tx,
        workspaceId: ctx.workspace.id,
        pageComponentIds: input.pageComponentIds,
      });

      // A non-empty set moves the maintenance to that page; an empty set
      // only clears associations and keeps `pageId` (same as status-report).
      // The dashboard edit sheet always sends the array, so nulling here
      // orphaned every maintenance edited without components.
      if (validated.pageId !== null) {
        updateValues.pageId = validated.pageId;
      }

      await updatePageComponentAssociations({
        tx,
        maintenanceId: existing.id,
        componentIds: validated.componentIds,
      });
    }

    if (input.message !== undefined) {
      await rewriteLatestUpdate(tx, ctx, existing.id, input.message);
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

/**
 * `message` is the newest update's text, so editing it rewrites that row.
 * A maintenance without updates (pre-backfill) gets one dated now instead.
 */
async function rewriteLatestUpdate(
  tx: DB,
  ctx: ServiceContext,
  maintenanceId: number,
  message: string,
): Promise<void> {
  const actorUserId = tryGetActorUserId(ctx.actor);
  const latest = await tx
    .select()
    .from(maintenanceUpdate)
    .where(eq(maintenanceUpdate.maintenanceId, maintenanceId))
    .orderBy(desc(maintenanceUpdate.date), desc(maintenanceUpdate.id))
    .limit(1)
    .get();

  if (!latest) {
    const created = await tx
      .insert(maintenanceUpdate)
      .values({
        maintenanceId,
        message,
        date: new Date(),
        createdBy: actorUserId,
        updatedBy: actorUserId,
      })
      .returning()
      .get();
    await emitAudit(tx, ctx, {
      action: "maintenance_update.create",
      entityType: "maintenance_update",
      entityId: created.id,
      after: created,
      metadata: { maintenanceId },
    });
    return;
  }

  if (latest.message === message) return;

  const updated = await tx
    .update(maintenanceUpdate)
    .set({ message, updatedAt: new Date(), updatedBy: actorUserId })
    .where(eq(maintenanceUpdate.id, latest.id))
    .returning()
    .get();
  if (!updated) {
    throw new InternalServiceError(
      `failed to update maintenance update ${latest.id}`,
    );
  }
  await emitAudit(tx, ctx, {
    action: "maintenance_update.update",
    entityType: "maintenance_update",
    entityId: updated.id,
    before: latest,
    after: updated,
    metadata: { maintenanceId },
  });
}
