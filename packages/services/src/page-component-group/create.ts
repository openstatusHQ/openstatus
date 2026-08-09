import { pageComponentGroup } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { assertPageInWorkspace } from "../page-component/internal";
import { CreatePageComponentGroupInput } from "./schemas";

export async function createPageComponentGroup(args: {
  ctx: ServiceContext;
  input: CreatePageComponentGroupInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = CreatePageComponentGroupInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    await assertPageInWorkspace({
      tx,
      pageId: input.pageId,
      workspaceId: ctx.workspace.id,
    });

    const created = await tx
      .insert(pageComponentGroup)
      .values({
        workspaceId: ctx.workspace.id,
        pageId: input.pageId,
        name: input.name,
        defaultOpen: input.defaultOpen,
      })
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page_component_group.create",
      entityType: "page_component_group",
      entityId: created.id,
      after: created,
    });

    return created;
  });
}
