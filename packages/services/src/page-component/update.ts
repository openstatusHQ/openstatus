import { eq } from "@openstatus/db";
import { pageComponent } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { assertGroupOnPage, getPageComponentInWorkspace } from "./internal";
import { UpdatePageComponentInput } from "./schemas";

export async function updatePageComponent(args: {
  ctx: ServiceContext;
  input: UpdatePageComponentInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdatePageComponentInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getPageComponentInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    if (input.groupId != null) {
      await assertGroupOnPage({
        tx,
        groupId: input.groupId,
        pageId: existing.pageId,
        workspaceId: ctx.workspace.id,
      });
    }

    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined) {
      values.description = input.description;
    }
    if (input.order !== undefined) values.order = input.order;
    if (input.groupId !== undefined) values.groupId = input.groupId;
    if (input.groupOrder !== undefined) values.groupOrder = input.groupOrder;

    const updated = await tx
      .update(pageComponent)
      .set(values)
      .where(eq(pageComponent.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page_component.update",
      entityType: "page_component",
      entityId: existing.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
