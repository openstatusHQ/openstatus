import { and, eq } from "@openstatus/db";
import { invitation } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { DeleteInvitationInput } from "./schemas";

/**
 * Delete a pending invitation. Scoped to the caller's workspace; a no-op
 * (no error) when the row doesn't exist — the legacy router also issues
 * an unconditional DELETE without a prior existence check.
 *
 * The audit row is only emitted when a row actually got deleted, so
 * unknown-id / wrong-workspace calls don't generate misleading entries.
 */
export async function deleteInvitation(args: {
  ctx: ServiceContext;
  input: DeleteInvitationInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteInvitationInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    const deleted = await tx
      .delete(invitation)
      .where(
        and(
          eq(invitation.id, input.id),
          eq(invitation.workspaceId, ctx.workspace.id),
        ),
      )
      .returning({ id: invitation.id });

    if (deleted.length === 0) return;

    await emitAudit(tx, ctx, {
      action: "invitation.delete",
      entityType: "invitation",
      entityId: input.id,
    });
  });
}
