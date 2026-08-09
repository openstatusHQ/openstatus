import { and, eq, isNull } from "@openstatus/db";
import { monitor, pageComponent } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, ForbiddenError } from "../errors";
import { assertWithinLimit } from "../limits";
import { assertGroupOnPage, assertPageInWorkspace } from "./internal";
import { CreatePageComponentInput } from "./schemas";

/**
 * Add a single component to a status page. Monitor components inherit the
 * monitor's name when the caller doesn't supply one.
 */
export async function createPageComponent(args: {
  ctx: ServiceContext;
  input: CreatePageComponentInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CreatePageComponentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await assertPageInWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });

    await assertWithinLimit({
      tx,
      workspaceId: ctx.workspace.id,
      limit: "page-components",
    });

    let name = input.name;
    if (input.type === "monitor") {
      // Soft-deleted monitors are excluded — a tombstoned monitor's id
      // shouldn't be attachable to a fresh component.
      const row = await tx
        .select({ id: monitor.id, name: monitor.name })
        .from(monitor)
        .where(
          and(
            // safe: the schema's refine guarantees monitorId on this branch
            eq(monitor.id, input.monitorId as number),
            eq(monitor.workspaceId, ctx.workspace.id),
            isNull(monitor.deletedAt),
          ),
        )
        .get();
      if (!row) throw new ForbiddenError("Invalid monitor IDs.");
      name = name ?? row.name;

      // `(pageId, monitorId)` is UNIQUE — pre-check so a duplicate reads as a
      // conflict rather than a raw driver constraint failure.
      const duplicate = await tx
        .select({ id: pageComponent.id })
        .from(pageComponent)
        .where(
          and(
            eq(pageComponent.pageId, input.pageId),
            eq(pageComponent.monitorId, row.id),
          ),
        )
        .get();
      if (duplicate) {
        throw new ConflictError(
          "This monitor is already a component on this page.",
        );
      }
    }

    if (input.groupId != null) {
      await assertGroupOnPage({
        tx,
        groupId: input.groupId,
        pageId: input.pageId,
        workspaceId: ctx.workspace.id,
      });
    }

    const created = await tx
      .insert(pageComponent)
      .values({
        workspaceId: ctx.workspace.id,
        pageId: input.pageId,
        type: input.type,
        monitorId: input.type === "monitor" ? input.monitorId : null,
        name: name ?? "",
        description: input.description ?? null,
        order: input.order,
        groupId: input.groupId ?? null,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page_component.create",
      entityType: "page_component",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}
