import { and, eq } from "@openstatus/db";
import { usersToWorkspaces } from "@openstatus/db/src/schema";
import { z } from "zod";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { NotFoundError, PreconditionFailedError } from "../errors";
import { DeleteMemberInput } from "./schemas";

// Composite-PK rows: drizzle's createSelectSchema would flatten the join,
// but the membership row has no auto-generated columns we'd want to drop
// from a snapshot. Inline parser keeps the audit `before` shape stable
// even if a column is added to `users_to_workspaces` later.
const memberRowSnapshot = z.object({
  userId: z.number(),
  workspaceId: z.number(),
  role: z.string(),
  createdAt: z.coerce.date().nullable(),
});

/**
 * Delete a member's workspace association. Idempotent on the target row —
 * if the target user has no membership in the caller's workspace (wrong id,
 * already removed, or scoped to a different workspace), the call succeeds
 * silently and no audit row is emitted. This matches the workspace-filtered
 * DELETE semantics inherited from the legacy router.
 *
 * Authorization rules preserved from the legacy router:
 *   - only the caller's own membership row is consulted; the `owner` role is
 *     required to remove anyone else;
 *   - an owner cannot remove themselves (would orphan the workspace).
 *
 * Both role-failure and self-removal surface as `PRECONDITION_FAILED` to
 * match the existing tRPC contract — these are state-based rejections, not
 * authz failures in the sense of "you lack any access to this workspace."
 *
 * Only fires when the actor is an openstatus user: removing another user is
 * not something a system / apiKey / webhook actor should do today.
 */
export async function deleteMember(args: {
  ctx: ServiceContext;
  input: DeleteMemberInput;
}): Promise<void> {
  const { ctx } = args;
  const input = DeleteMemberInput.parse(args.input);

  if (ctx.actor.type !== "user") {
    throw new PreconditionFailedError(
      "Only user actors can remove workspace members",
    );
  }
  const callerId = ctx.actor.userId;

  await withTransaction(ctx, async (tx) => {
    const caller = await tx.query.usersToWorkspaces.findFirst({
      where: and(
        eq(usersToWorkspaces.userId, callerId),
        eq(usersToWorkspaces.workspaceId, ctx.workspace.id),
      ),
    });

    if (!caller) {
      throw new NotFoundError("membership", callerId);
    }

    if (caller.role !== "owner") {
      throw new PreconditionFailedError(
        "Not authorized to remove user from workspace",
      );
    }

    if (input.userId === callerId) {
      throw new PreconditionFailedError(
        "Cannot remove yourself from workspace",
      );
    }

    const [removed] = await tx
      .delete(usersToWorkspaces)
      .where(
        and(
          eq(usersToWorkspaces.workspaceId, ctx.workspace.id),
          eq(usersToWorkspaces.userId, input.userId),
        ),
      )
      .returning();

    if (!removed) return;

    await emitAudit(tx, ctx, {
      action: "member.delete",
      entityType: "member",
      entityId: input.userId,
      before: memberRowSnapshot.parse(removed),
    });
  });
}
