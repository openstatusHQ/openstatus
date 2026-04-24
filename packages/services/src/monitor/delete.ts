import { and, eq, inArray, isNull } from "@openstatus/db";
import {
  monitor,
  monitorTagsToMonitors,
  notificationsToMonitors,
  pageComponent,
  privateLocationToMonitors,
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
    // Filter out already soft-deleted rows — otherwise a second call would
    // re-run the side effects and emit a duplicate audit.
    const existing = await tx
      .select()
      .from(monitor)
      .where(
        and(
          eq(monitor.id, input.id),
          eq(monitor.workspaceId, ctx.workspace.id),
          isNull(monitor.deletedAt),
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
    // Also tear down `privateLocationToMonitors` — this join table was
    // previously left behind on soft-delete, leaving orphaned
    // `(privateLocationId, monitorId)` rows pointing at a tombstoned
    // monitor. Scheduling queries that read this join can then try to
    // route probes to a deleted monitor.
    await tx
      .delete(privateLocationToMonitors)
      .where(eq(privateLocationToMonitors.monitorId, existing.id));

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
      // Report the first *actually missing* id rather than always
      // blaming `ids[0]`, which misled callers whenever a mix of valid
      // and invalid ids was passed (valid `ids[0]` still appeared in
      // the error even though a later id was the real miss).
      const foundIds = new Set(existing.map((r) => r.id));
      const missingId = ids.find((id) => !foundIds.has(id)) ?? -1;
      throw new NotFoundError("monitor", missingId);
    }

    // Layered defense: repeat `workspaceId` on every mutation that has
    // the column, even though the pre-check above already validated
    // all ids belong to the caller's workspace (same transaction,
    // deduped ids). The belt-and-braces `AND workspace_id = ?` closes
    // the copy-paste footgun if this block ever gets reused in a
    // context without the pre-check. `monitorTagsToMonitors` and
    // `notificationsToMonitors` don't carry `workspaceId` — they're
    // scoped through the `monitor` FK's cascade, so the pre-check is
    // the only practical guard there.
    await tx
      .update(monitor)
      .set({ deletedAt: new Date(), active: false })
      .where(
        and(
          inArray(monitor.id, ids),
          eq(monitor.workspaceId, ctx.workspace.id),
        ),
      );
    await tx
      .delete(monitorTagsToMonitors)
      .where(inArray(monitorTagsToMonitors.monitorId, ids));
    await tx
      .delete(notificationsToMonitors)
      .where(inArray(notificationsToMonitors.monitorId, ids));
    await tx
      .delete(pageComponent)
      .where(
        and(
          inArray(pageComponent.monitorId, ids),
          eq(pageComponent.workspaceId, ctx.workspace.id),
        ),
      );
    // Match the single-delete cleanup — bulk soft-delete also has to
    // strip `privateLocationToMonitors` so scheduling queries don't
    // keep routing probes to tombstoned monitors.
    await tx
      .delete(privateLocationToMonitors)
      .where(inArray(privateLocationToMonitors.monitorId, ids));

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
