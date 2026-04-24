import { eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { UpdateWorkspaceNameInput } from "./schemas";

/**
 * Rename the caller's workspace. No conflict check — workspace names are
 * not globally unique today; slugs are. Preserves legacy parity.
 */
export async function updateWorkspaceName(args: {
  ctx: ServiceContext;
  input: UpdateWorkspaceNameInput;
}): Promise<void> {
  const { ctx } = args;
  const input = UpdateWorkspaceNameInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    await tx
      .update(workspace)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(workspace.id, ctx.workspace.id));

    await emitAudit(tx, ctx, {
      action: "workspace.update_name",
      entityType: "workspace",
      entityId: ctx.workspace.id,
      metadata: { name: input.name },
    });
  });
}
