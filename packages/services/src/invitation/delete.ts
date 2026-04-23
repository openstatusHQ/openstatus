import { and, eq } from "@openstatus/db";
import { invitation } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { DeleteInvitationInput } from "./schemas";

/**
 * Delete a pending invitation. Scoped to the caller's workspace; a no-op
 * (no error) when the row doesn't exist — the legacy router also issues
 * an unconditional DELETE without a prior existence check.
 */
export async function deleteInvitation(args: {
  ctx: ServiceContext;
  input: DeleteInvitationInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteInvitationInput.parse(args.input);

  await withTransaction(ctx, async (tx) => {
    await tx
      .delete(invitation)
      .where(
        and(
          eq(invitation.id, input.id),
          eq(invitation.workspaceId, ctx.workspace.id),
        ),
      );

    await emitAudit(tx, ctx, {
      action: "invitation.delete",
      entityType: "invitation",
      entityId: input.id,
    });
  });
}
