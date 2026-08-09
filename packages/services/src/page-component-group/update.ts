import { eq } from "@openstatus/db";
import { pageComponentGroup } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getGroupInWorkspace } from "./internal";
import { UpdatePageComponentGroupInput } from "./schemas";

export async function updatePageComponentGroup(args: {
  ctx: ServiceContext;
  input: UpdatePageComponentGroupInput;
}) {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = UpdatePageComponentGroupInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const existing = await getGroupInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.defaultOpen !== undefined) values.defaultOpen = input.defaultOpen;

    const updated = await tx
      .update(pageComponentGroup)
      .set(values)
      .where(eq(pageComponentGroup.id, existing.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "page_component_group.update",
      entityType: "page_component_group",
      entityId: existing.id,
      before: existing,
      after: updated,
    });

    return updated;
  });
}
