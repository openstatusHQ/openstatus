import { eq } from "@openstatus/db";
import { pageComponentGroup } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { getGroupInWorkspace } from "./internal";
import { DeletePageComponentGroupInput } from "./schemas";

/**
 * Hard-delete a group. Member components survive with `group_id` reset to
 * NULL (FK `ON DELETE SET NULL`) — they fall back to the ungrouped list.
 */
export async function deletePageComponentGroup(args: {
  ctx: ServiceContext;
  input: DeletePageComponentGroupInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = DeletePageComponentGroupInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const existing = await getGroupInWorkspace({
      tx,
      id: input.id,
      workspaceId: ctx.workspace.id,
    });

    await tx
      .delete(pageComponentGroup)
      .where(eq(pageComponentGroup.id, existing.id));

    await emitAudit(tx, ctx, {
      action: "page_component_group.delete",
      entityType: "page_component_group",
      entityId: existing.id,
      before: existing,
    });
  });
}
