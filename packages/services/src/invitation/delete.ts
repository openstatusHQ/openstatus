import { and, eq, isNull } from "@openstatus/db";
import { invitation } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { DeleteInvitationInput } from "./schemas";

/**
 * Delete a pending invitation. Scoped to the caller's workspace; a no-op
 * (no error) when the row doesn't exist — the legacy router also issues
 * an unconditional DELETE without a prior existence check.
 *
 * Only **pending** invitations can be deleted: the `acceptedAt IS NULL`
 * guard preserves the audit trail for accepted invites and prevents a
 * workspace owner from unilaterally wiping the "this user was invited
 * on date X" record after they've joined. Accepted invitations survive
 * as a historical breadcrumb.
 *
 * The audit row is only emitted when a row actually got deleted, so
 * unknown-id / wrong-workspace / already-accepted calls don't generate
 * misleading entries.
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
          isNull(invitation.acceptedAt),
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
