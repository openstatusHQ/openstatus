import { and, eq, inArray, ne, sql } from "@openstatus/db";
import { pageComponent, pageComponentGroup } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { LimitExceededError, ValidationError } from "../errors";
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

  // Reject duplicate group ids up front — otherwise the diff loop
  // UPDATEs the same row twice (each iteration clobbering the previous
  // write) and silently collapses two input groups' components into one
  // persisted group. A rare client bug, but the failure mode is data
  // loss on the association side.
  const inputGroupIds = input.groups
    .map((g) => g.id)
    .filter((id): id is number => id != null);
  if (new Set(inputGroupIds).size !== inputGroupIds.length) {
    throw new ValidationError("Duplicate group id in input.");
  }

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

    // Guardrail against mass-delete via id-loss. If the input has any
    // static components *and* none of them carry ids, the diff below
    // treats every existing static as "removed" and cascades through
    // `statusReportsToPageComponents`, `maintenancesToPageComponents`,
    // and `pageSubscriberToPageComponent`. Reject the call instead.
    //
    // The legitimate "delete all statics" intent is an input with zero
    // static entries, which still runs through the normal diff — this
    // guard only catches the ambiguous "new statics alongside existing
    // ones, but the client forgot to round-trip the existing ids" case.
    const inputHasAnyStatic =
      input.components.some((c) => c.type === "static") ||
      input.groups.some((g) => g.components.some((c) => c.type === "static"));
    const hasExistingStatics = existingComponents.some(
      (c) => c.type === "static",
    );
    if (
      inputHasAnyStatic &&
      inputStaticComponentIds.length === 0 &&
      hasExistingStatics
    ) {
      throw new ValidationError(
        "Existing static components must round-trip their ids.",
      );
    }

    // Remove monitor components whose monitorId isn't in the new input.
    const removedMonitorComponents = existingComponents.filter(
      (c) =>
        c.type === "monitor" &&
        c.monitorId &&
        !inputMonitorIds.includes(c.monitorId),
    );

    // Static component removal: drop existing statics whose ids aren't
    // round-tripped by the input. Components with matching ids take the
    // UPDATE branch below, new statics (no id) get INSERTed.
    //
    // The previous "if input has no ids, drop all" fallback was a
    // footgun: `pageSubscriberToPageComponent`, `maintenancesToPageComponents`,
    // and `statusReportsToPageComponents` all FK to `page_component.id`
    // with `ON DELETE CASCADE`, so recreate-on-each-save would wipe every
    // subscriber scope / active maintenance / status-report association
    // the moment a static came in without its id.
    const removedStaticComponents = existingComponents.filter(
      (c) => c.type === "static" && !inputStaticComponentIds.includes(c.id),
    );

    const removedComponentIds = [
      ...removedMonitorComponents.map((c) => c.id),
      ...removedStaticComponents.map((c) => c.id),
    ];

    const removedComponents = [
      ...removedMonitorComponents,
      ...removedStaticComponents,
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

      for (const row of removedComponents) {
        await emitAudit(tx, ctx, {
          action: "page_component.delete",
          entityType: "page_component",
          entityId: row.id,
          before: row,
        });
      }
    }

    // Groups: diff-and-reconcile by id instead of delete-and-recreate.
    //
    // Every FK pointing at a page-component or group has `ON DELETE`
    // semantics that matter on the dashboard flow — subscribers,
    // maintenances, and status reports FK to component ids with CASCADE;
    // components FK to group ids with SET NULL. Blindly dropping groups
    // on every save would flatten nested components out into the top
    // level. Preserving ids keeps those associations intact.
    const existingGroupById = new Map(existingGroups.map((g) => [g.id, g]));
    const inputGroupIdSet = new Set(
      input.groups.map((g) => g.id).filter((id): id is number => id != null),
    );
    const groupsToDelete = existingGroups.filter(
      (g) => !inputGroupIdSet.has(g.id),
    );

    // `page_component.group_id` is `ON DELETE SET NULL`, so we could let
    // the FK null out orphaned refs. Clearing explicitly here is cheaper
    // than surfacing a half-broken layout in the (rare) case the cascade
    // misfires, and keeps behavior identical to the pre-refactor flow.
    if (groupsToDelete.length > 0) {
      const idsToDelete = groupsToDelete.map((g) => g.id);
      await tx
        .update(pageComponent)
        .set({ groupId: null })
        .where(
          and(
            eq(pageComponent.pageId, input.pageId),
            eq(pageComponent.workspaceId, ctx.workspace.id),
            inArray(pageComponent.groupId, idsToDelete),
          ),
        );
      await tx
        .delete(pageComponentGroup)
        .where(
          and(
            eq(pageComponentGroup.pageId, input.pageId),
            eq(pageComponentGroup.workspaceId, ctx.workspace.id),
            inArray(pageComponentGroup.id, idsToDelete),
          ),
        );

      for (const g of groupsToDelete) {
        await emitAudit(tx, ctx, {
          action: "page_component_group.delete",
          entityType: "page_component_group",
          entityId: g.id,
          before: g,
        });
      }
    }

    // Walk input.groups in order so `newGroups[i]` lines up with
    // `input.groups[i]` for the component mapping below. Each slot
    // resolves to an existing group id (UPDATE path) or a freshly
    // inserted one (CREATE path).
    const newGroups: Array<{ id: number; name: string }> = [];
    for (const g of input.groups) {
      const existing = g.id != null ? existingGroupById.get(g.id) : undefined;

      if (existing) {
        const [updated] = await tx
          .update(pageComponentGroup)
          .set({
            name: g.name,
            defaultOpen: g.defaultOpen,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(pageComponentGroup.id, existing.id),
              eq(pageComponentGroup.pageId, input.pageId),
              eq(pageComponentGroup.workspaceId, ctx.workspace.id),
            ),
          )
          .returning();
        if (!updated) {
          throw new Error("Failed to update page component group");
        }
        newGroups.push({ id: updated.id, name: updated.name });

        await emitAudit(tx, ctx, {
          action: "page_component_group.update",
          entityType: "page_component_group",
          entityId: updated.id,
          before: existing,
          after: updated,
        });
      } else {
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
        newGroups.push({ id: created.id, name: created.name });

        await emitAudit(tx, ctx, {
          action: "page_component_group.create",
          entityType: "page_component_group",
          entityId: created.id,
          after: created,
        });
      }
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
    // Pre-classify create vs update by looking up each input monitorId in
    // the pre-upsert snapshot, so we can emit the right audit action per
    // row regardless of which branch the upsert takes for that row.
    const existingByMonitorId = new Map(
      existingComponents
        .filter(
          (c): c is typeof c & { monitorId: number } =>
            c.type === "monitor" && c.monitorId != null,
        )
        .map((c) => [c.monitorId, c]),
    );

    if (monitorComponents.length > 0) {
      const upserted = await tx
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
        })
        .returning();

      for (const after of upserted) {
        if (after.monitorId == null) continue;
        const before = existingByMonitorId.get(after.monitorId);
        if (before) {
          await emitAudit(tx, ctx, {
            action: "page_component.update",
            entityType: "page_component",
            entityId: after.id,
            before,
            after,
          });
        } else {
          await emitAudit(tx, ctx, {
            action: "page_component.create",
            entityType: "page_component",
            entityId: after.id,
            after,
          });
        }
      }
    }

    // Restrict the "take update path" set to ids that (a) still exist
    // after the delete pass above and (b) correspond to *static* rows.
    // Without both filters, an input static carrying an id that just
    // got deleted (e.g. because the row was a monitor component whose
    // monitorId is no longer in the input set) would match `has(id)`
    // on the stale pre-delete snapshot, take the UPDATE branch, and
    // silently no-op — the new static never gets inserted.
    const removedIdSet = new Set(removedComponentIds);
    const existingStaticById = new Map(
      existingComponents
        .filter((c) => c.type === "static" && !removedIdSet.has(c.id))
        .map((c) => [c.id, c]),
    );

    for (const c of staticComponents) {
      const before = c.id ? existingStaticById.get(c.id) : undefined;
      if (before) {
        const [after] = await tx
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
              eq(pageComponent.id, before.id),
              eq(pageComponent.pageId, input.pageId),
              eq(pageComponent.workspaceId, ctx.workspace.id),
            ),
          )
          .returning();
        if (!after) {
          throw new Error("Failed to update static component");
        }

        await emitAudit(tx, ctx, {
          action: "page_component.update",
          entityType: "page_component",
          entityId: after.id,
          before,
          after,
        });
      } else {
        const [created] = await tx
          .insert(pageComponent)
          .values({
            pageId: c.pageId,
            workspaceId: c.workspaceId,
            name: c.name,
            description: c.description,
            type: c.type,
            monitorId: c.monitorId,
            order: c.order,
            groupId: c.groupId,
            groupOrder: c.groupOrder,
          })
          .returning();
        if (!created) {
          throw new Error("Failed to insert static component");
        }

        await emitAudit(tx, ctx, {
          action: "page_component.create",
          entityType: "page_component",
          entityId: created.id,
          after: created,
        });
      }
    }
  });
}
