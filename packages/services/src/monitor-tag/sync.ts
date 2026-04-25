import { and, eq, inArray } from "@openstatus/db";
import { monitorTag, selectMonitorTagSchema } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ForbiddenError } from "../errors";
import type { MonitorTag } from "../types";
import { SyncMonitorTagsInput } from "./schemas";

/**
 * Reconcile the workspace's tag set with the provided list.
 *
 * Semantics preserved from the legacy router:
 *   - tags not present in the input (by id) are deleted;
 *   - tags with an id are updated in place (`name` + `color`);
 *   - tags without an id are inserted.
 *
 * Audit is emitted per row inside the same transaction — `monitor_tag`
 * has its own create/update/delete variants in the audit union, and the
 * `update` emit is suppressed by `emitAudit` when the diff is empty (so
 * round-trips that re-save unchanged tags don't pollute the log).
 */
export async function syncMonitorTags(args: {
  ctx: ServiceContext;
  input: SyncMonitorTagsInput;
}): Promise<MonitorTag[]> {
  const { ctx } = args;
  const { tags } = SyncMonitorTagsInput.parse(args.input);
  const workspaceId = ctx.workspace.id;

  return withTransaction(ctx, async (tx) => {
    const existing = await tx.query.monitorTag.findMany({
      where: eq(monitorTag.workspaceId, workspaceId),
    });

    const keepIds = new Set(
      tags.map((t) => t.id).filter((id): id is number => id !== undefined),
    );
    const existingById = new Map(existing.map((t) => [t.id, t]));

    const toRemove = existing.filter((t) => !keepIds.has(t.id));

    if (toRemove.length > 0) {
      await tx
        .delete(monitorTag)
        .where(
          and(
            eq(monitorTag.workspaceId, workspaceId),
            inArray(
              monitorTag.id,
              toRemove.map((t) => t.id),
            ),
          ),
        )
        .run();

      for (const removed of toRemove) {
        await emitAudit(tx, ctx, {
          action: "monitor_tag.delete",
          entityType: "monitor_tag",
          entityId: removed.id,
          before: selectMonitorTagSchema.parse(removed),
        });
      }
    }

    const results: MonitorTag[] = [];
    for (const tag of tags) {
      if (tag.id !== undefined) {
        const before = existingById.get(tag.id);
        const updated = await tx
          .update(monitorTag)
          .set({
            name: tag.name,
            color: tag.color,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(monitorTag.workspaceId, workspaceId),
              eq(monitorTag.id, tag.id),
            ),
          )
          .returning()
          .get();

        // Caller passed an id that doesn't belong to this workspace.
        // Fail-closed: throwing rolls back the surrounding transaction
        // (including the earlier deletions), rather than letting a
        // partial sync commit when the input is malformed.
        if (!updated) {
          throw new ForbiddenError("Invalid monitor tag IDs.");
        }

        const parsed = selectMonitorTagSchema.parse(updated);
        results.push(parsed);

        if (before) {
          await emitAudit(tx, ctx, {
            action: "monitor_tag.update",
            entityType: "monitor_tag",
            entityId: parsed.id,
            before: selectMonitorTagSchema.parse(before),
            after: parsed,
          });
        }
      } else {
        const created = await tx
          .insert(monitorTag)
          .values({
            name: tag.name,
            color: tag.color,
            workspaceId,
          })
          .returning()
          .get();

        const parsed = selectMonitorTagSchema.parse(created);
        results.push(parsed);

        await emitAudit(tx, ctx, {
          action: "monitor_tag.create",
          entityType: "monitor_tag",
          entityId: parsed.id,
          after: parsed,
        });
      }
    }

    return results;
  });
}
