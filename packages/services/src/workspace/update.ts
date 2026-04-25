import { eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError } from "../errors";
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
    const existing = await tx
      .select()
      .from(workspace)
      .where(eq(workspace.id, ctx.workspace.id))
      .get();
    // Workspace is derived from `ctx.workspace`, so absence here is a
    // state anomaly (concurrent delete?). Fail closed rather than emit
    // an audit row without a `before` snapshot.
    if (!existing) throw new NotFoundError("workspace", ctx.workspace.id);

    const updated = await tx
      .update(workspace)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(workspace.id, ctx.workspace.id))
      .returning()
      .get();

    await emitAudit(tx, ctx, {
      action: "workspace.update",
      entityType: "workspace",
      entityId: ctx.workspace.id,
      before: existing,
      after: updated,
    });
  });
}
