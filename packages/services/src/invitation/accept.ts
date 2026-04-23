import { and, eq, gte, isNull } from "@openstatus/db";
import {
  invitation,
  selectWorkspaceSchema,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ConflictError, NotFoundError, UnauthorizedError } from "../errors";
import type { Workspace } from "../types";
import { AcceptInvitationInput } from "./schemas";

/**
 * Accept an invitation: stamp `acceptedAt`, add the accepting user to the
 * target workspace with the invitation's role, and return the workspace
 * row.
 *
 * The lookup is scoped by id + email + unexpired + not-yet-accepted to
 * prevent token-sharing. To stay race-safe, the acceptance write is a
 * conditional UPDATE that re-asserts `acceptedAt IS NULL` — two concurrent
 * callers that both pass the initial read will see exactly one row
 * returned from the update; the loser throws `ConflictError` and the
 * transaction aborts before the membership insert runs.
 *
 * The membership is inserted under `ctx.actor`'s user id — taking it
 * from input would let any caller that knows the token+email create
 * a membership for an arbitrary user. Same defense pattern as
 * `createApiKey.createdById`.
 */
export async function acceptInvitation(args: {
  ctx: ServiceContext;
  input: AcceptInvitationInput;
}): Promise<Workspace> {
  const { ctx } = args;
  const input = AcceptInvitationInput.parse(args.input);

  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Invitations must be accepted by a known user actor.",
    );
  }

  return withTransaction(ctx, async (tx) => {
    const existing = await tx.query.invitation.findFirst({
      where: and(
        eq(invitation.id, input.id),
        eq(invitation.email, input.email),
        isNull(invitation.acceptedAt),
        gte(invitation.expiresAt, new Date()),
      ),
      with: { workspace: true },
    });

    if (!existing) throw new NotFoundError("invitation", input.id);

    // Conditional UPDATE — the `isNull(acceptedAt)` predicate makes the
    // write a no-op for any row another caller has already claimed, even
    // if both callers passed the read check above. Returning rowcount ==
    // 0 means we lost the race.
    const claimed = await tx
      .update(invitation)
      .set({ acceptedAt: new Date() })
      .where(and(eq(invitation.id, input.id), isNull(invitation.acceptedAt)))
      .returning({ id: invitation.id });

    if (claimed.length === 0) {
      throw new ConflictError("Invitation already accepted.");
    }

    await tx.insert(usersToWorkspaces).values({
      userId,
      workspaceId: existing.workspaceId,
      role: existing.role,
    });

    const fresh = await tx.query.workspace.findFirst({
      where: eq(workspace.id, existing.workspaceId),
    });

    if (!fresh) throw new NotFoundError("workspace", existing.workspaceId);

    await emitAudit(tx, ctx, {
      action: "invitation.accept",
      entityType: "invitation",
      entityId: input.id,
      metadata: { workspaceId: existing.workspaceId, role: existing.role },
    });

    return selectWorkspaceSchema.parse(fresh);
  });
}
