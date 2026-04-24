import { and, eq, inArray, ne, sql } from "@openstatus/db";
import { pageComponent, pageComponentGroup } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { LimitExceededError } from "../errors";
import { assertPageInWorkspace, validateMonitorIds } from "./internal";
import { UpdatePageComponentOrderInput } from "./schemas";

/**
 * Replace the full order/layout of a page's components and groups in one
 * transaction. Mirrors the pre-migration tRPC behaviour exactly — the
 * update-order flow is a diff-and-reconcile pass:
 *
 *   1. Validate the page is in the workspace.
 *   2. Enforce the `page-components` plan limit across the workspace.
 *   3. Validate every monitor id on the input set belongs to the workspace.
 *   4. Delete removed monitor and static components.
 *   5. Clear `groupId` on all components (prevents FK errors before the
 *      next step), then delete existing groups and recreate them.
 *   6. Upsert monitor components via the `(pageId, monitorId)` unique
 *      constraint (preserves existing ids).
 *   7. Update existing static components by id; insert new ones.
 */
export async function updatePageComponentOrder(args: {
  ctx: ServiceContext;
  input: UpdatePageComponentOrderInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdatePageComponentOrderInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    await assertPageInWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });

    const pageComponentLimit = ctx.workspace.limits["page-components"];

    const existingComponents = await tx
      .select()
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.pageId, input.pageId),
          eq(pageComponent.workspaceId, ctx.workspace.id),
        ),
      )
      .all();

    // Count components on OTHER pages so we can reject requests that push
    // the workspace past the plan cap.
    const otherPagesComponentCount = await tx
      .select({ id: pageComponent.id })
      .from(pageComponent)
      .where(
        and(
          eq(pageComponent.workspaceId, ctx.workspace.id),
          ne(pageComponent.pageId, input.pageId),
        ),
      )
      .all();

    const inputComponentCount =
      input.components.length +
      input.groups.reduce((sum, g) => sum + g.components.length, 0);

    const totalAfterUpdate =
      otherPagesComponentCount.length + inputComponentCount;

    if (totalAfterUpdate > pageComponentLimit) {
      throw new LimitExceededError("page-components", pageComponentLimit);
    }

    const existingGroups = await tx
      .select()
      .from(pageComponentGroup)
      .where(
        and(
          eq(pageComponentGroup.pageId, input.pageId),
          eq(pageComponentGroup.workspaceId, ctx.workspace.id),
        ),
      )
      .all();

    const existingGroupIds = existingGroups.map((g) => g.id);

    // `schemas.ts` enforces the `type === "monitor" → monitorId != null`
    // invariant via `.refine`, but the refined type is still flat so we
    // keep the defensive `&& c.monitorId` guard to narrow
    // `monitorId: number | null | undefined` to `number` for TS. The
    // refine parse would have already rejected any violating input.
    const inputMonitorIds = [
      ...input.components
        .filter((c) => c.type === "monitor" && c.monitorId)
        .map((c) => c.monitorId),
      ...input.groups.flatMap((g) =>
        g.components
          .filter((c) => c.type === "monitor" && c.monitorId)
          .map((c) => c.monitorId),
      ),
    ] as number[];

    await validateMonitorIds({
      tx,
      workspaceId: ctx.workspace.id,
      monitorIds: inputMonitorIds,
    });

    const inputStaticComponentIds = [
      ...input.components
        .filter((c) => c.type === "static" && c.id)
        .map((c) => c.id),
      ...input.groups.flatMap((g) =>
        g.components
          .filter((c) => c.type === "static" && c.id)
          .map((c) => c.id),
      ),
    ] as number[];

    // Remove monitor components whose monitorId isn't in the new input.
    const removedMonitorComponents = existingComponents.filter(
      (c) =>
        c.type === "monitor" &&
        c.monitorId &&
        !inputMonitorIds.includes(c.monitorId),
    );

    // Static component removal: if any input static components carry ids
    // we keep those and drop the rest; otherwise drop all existing static
    // components. Matches the pre-migration semantics for the "recreate
    // from scratch" flow the dashboard uses.
    //
    // Simplified from a previous two-step guard that branched on
    // `hasStaticComponentsInInput` first — both "input has static with
    // no ids" and "input has no static at all" collapsed to the same
    // "drop all" action, so the outer check was dead weight.
    const removedStaticComponents = existingComponents.filter((c) => {
      if (c.type !== "static") return false;
      if (inputStaticComponentIds.length > 0) {
        return !inputStaticComponentIds.includes(c.id);
      }
      return true;
    });

    const removedComponentIds = [
      ...removedMonitorComponents.map((c) => c.id),
      ...removedStaticComponents.map((c) => c.id),
    ];

    if (removedComponentIds.length > 0) {
      await tx
        .delete(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, input.pageId),
            eq(pageComponent.workspaceId, ctx.workspace.id),
            inArray(pageComponent.id, removedComponentIds),
          ),
        );
    }

    // Clear `groupId` before deleting groups — otherwise the FK blocks us.
    if (existingGroupIds.length > 0) {
      await tx
        .update(pageComponent)
        .set({ groupId: null })
        .where(
          and(
            eq(pageComponent.pageId, input.pageId),
            eq(pageComponent.workspaceId, ctx.workspace.id),
            inArray(pageComponent.groupId, existingGroupIds),
          ),
        );
    }

    if (existingGroupIds.length > 0) {
      await tx
        .delete(pageComponentGroup)
        .where(
          and(
            eq(pageComponentGroup.pageId, input.pageId),
            eq(pageComponentGroup.workspaceId, ctx.workspace.id),
          ),
        );
    }

    // Sequential inserts instead of a bulk `.values([...]).returning()`.
    // The previous bulk call relied on Drizzle/SQLite returning rows in
    // the same order as they were inserted to line up `newGroups[i]`
    // with `input.groups[i]` when the component mapping below runs.
    // Turso/libSQL happens to preserve that order today, but it's an
    // implicit coupling — any future driver change, batch split, or
    // sort side-effect would silently land components in the wrong
    // group with no error signal. Inserting one at a time is trivial
    // cost for a small set (groups on a status page are capped) and
    // makes the index alignment a guarantee rather than an assumption.
    const newGroups: Array<{ id: number; name: string }> = [];
    for (const g of input.groups) {
      const [created] = await tx
        .insert(pageComponentGroup)
        .values({
          pageId: input.pageId,
          workspaceId: ctx.workspace.id,
          name: g.name,
          defaultOpen: g.defaultOpen,
        })
        .returning();
      if (!created) {
        throw new Error("Failed to insert page component group");
      }
      newGroups.push(created);
    }

    const groupComponentValues = input.groups.flatMap((g, i) =>
      g.components.map((c) => ({
        id: c.id,
        pageId: input.pageId,
        workspaceId: ctx.workspace.id,
        name: c.name,
        description: c.description,
        type: c.type,
        monitorId: c.monitorId,
        order: g.order,
        groupId: newGroups[i]?.id,
        groupOrder: c.order,
      })),
    );

    const standaloneComponentValues = input.components.map((c) => ({
      id: c.id,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
      name: c.name,
      description: c.description,
      type: c.type,
      monitorId: c.monitorId,
      order: c.order,
      groupId: null as number | null,
      groupOrder: null as number | null,
    }));

    const allComponentValues = [
      ...groupComponentValues,
      ...standaloneComponentValues,
    ];

    const monitorComponents = allComponentValues.filter(
      (c) => c.type === "monitor" && c.monitorId,
    );
    const staticComponents = allComponentValues.filter(
      (c) => c.type === "static",
    );

    // Use the `(pageId, monitorId)` unique constraint to preserve ids.
    if (monitorComponents.length > 0) {
      await tx
        .insert(pageComponent)
        .values(monitorComponents)
        .onConflictDoUpdate({
          target: [pageComponent.pageId, pageComponent.monitorId],
          set: {
            name: sql.raw("excluded.`name`"),
            description: sql.raw("excluded.`description`"),
            order: sql.raw("excluded.`order`"),
            groupId: sql.raw("excluded.`group_id`"),
            groupOrder: sql.raw("excluded.`group_order`"),
            updatedAt: sql`(strftime('%s', 'now'))`,
          },
        });
    }

    // Restrict the "take update path" set to ids that (a) still exist
    // after the delete pass above and (b) correspond to *static* rows.
    // Without both filters, an input static carrying an id that just
    // got deleted (e.g. because the row was a monitor component whose
    // monitorId is no longer in the input set) would match `has(id)`
    // on the stale pre-delete snapshot, take the UPDATE branch, and
    // silently no-op — the new static never gets inserted.
    const removedIdSet = new Set(removedComponentIds);
    const existingStaticComponentIds = new Set(
      existingComponents
        .filter((c) => c.type === "static" && !removedIdSet.has(c.id))
        .map((c) => c.id),
    );

    for (const c of staticComponents) {
      if (c.id && existingStaticComponentIds.has(c.id)) {
        await tx
          .update(pageComponent)
          .set({
            name: c.name,
            description: c.description,
            type: c.type,
            monitorId: c.monitorId,
            order: c.order,
            groupId: c.groupId,
            groupOrder: c.groupOrder,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(pageComponent.id, c.id),
              eq(pageComponent.pageId, input.pageId),
              eq(pageComponent.workspaceId, ctx.workspace.id),
            ),
          );
      } else {
        await tx.insert(pageComponent).values({
          pageId: c.pageId,
          workspaceId: c.workspaceId,
          name: c.name,
          description: c.description,
          type: c.type,
          monitorId: c.monitorId,
          order: c.order,
          groupId: c.groupId,
          groupOrder: c.groupOrder,
        });
      }
    }

    await emitAudit(tx, ctx, {
      action: "page_component.update_order",
      entityType: "page",
      entityId: input.pageId,
      metadata: {
        componentCount: inputComponentCount,
        groupCount: input.groups.length,
      },
    });
  });
}
