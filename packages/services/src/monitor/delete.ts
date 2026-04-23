import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  monitorTagsToMonitors,
  notificationsToMonitors,
  pageComponent,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
import { DeleteMonitorInput, DeleteMonitorsInput } from "./schemas";

/**
 * Soft-delete a single monitor. Sets `deleted_at` + `active = false` and
 * tears down the tag / notification / page-component associations in the
 * same transaction.
 */
export async function deleteMonitor(args: {
  ctx: ServiceContext;
  input: DeleteMonitorInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteMonitorInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await tx
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.id, input.id),
          eq(monitor.workspaceId, ctx.workspace.id),
        ),
      )
      .get();
    if (!existing) throw new NotFoundError("monitor", input.id);

    await tx
      .update(monitor)
      .set({ deletedAt: new Date(), active: false })
      .where(eq(monitor.id, existing.id));
    await tx
      .delete(monitorTagsToMonitors)
      .where(eq(monitorTagsToMonitors.monitorId, existing.id));
    await tx
      .delete(notificationsToMonitors)
      .where(eq(notificationsToMonitors.monitorId, existing.id));
    await tx
      .delete(pageComponent)
      .where(eq(pageComponent.monitorId, existing.id));

    await emitAudit(tx, ctx, {
      action: "monitor.delete",
      entityType: "monitor",
      entityId: existing.id,
      before: existing,
    });
  });
}

/**
 * Bulk soft-delete. Requires all ids resolve to monitors in the caller's
 * workspace (cross-workspace or already-deleted ids fail the pre-check).
 */
export async function deleteMonitors(args: {
  ctx: ServiceContext;
  input: DeleteMonitorsInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteMonitorsInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const ids = Array.from(new Set(input.ids));
    const existing = await tx
      .select()
      .from(monitor)
      .where(
        and(
          inArray(monitor.id, ids),
          eq(monitor.workspaceId, ctx.workspace.id),
          isNull(monitor.deletedAt),
        ),
      )
      .all();
    if (existing.length !== ids.length) {
      throw new NotFoundError("monitor", ids[0] ?? -1);
    }

    await tx
      .update(monitor)
      .set({ deletedAt: new Date(), active: false })
      .where(inArray(monitor.id, ids));
    await tx
      .delete(monitorTagsToMonitors)
      .where(inArray(monitorTagsToMonitors.monitorId, ids));
    await tx
      .delete(notificationsToMonitors)
      .where(inArray(notificationsToMonitors.monitorId, ids));
    await tx.delete(pageComponent).where(inArray(pageComponent.monitorId, ids));

    for (const row of existing) {
      await emitAudit(tx, ctx, {
        action: "monitor.delete",
        entityType: "monitor",
        entityId: row.id,
        before: row,
      });
    }
  });
}
