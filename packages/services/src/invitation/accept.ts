import { and, eq, gte, isNull } from "@openstatus/db";
import {
  invitation,
  selectWorkspaceSchema,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { ConflictError, NotFoundError, UnauthorizedError } from "../errors";
import type { Workspace } from "../types";
import { AcceptInvitationInput } from "./schemas";

/**
 * Accept an invitation: stamp `acceptedAt`, add the accepting user to the
 * target workspace with the invitation's role, and return the workspace
 * row.
 *
 * Invitation lookup is scoped by id + email + unexpired + not-yet-accepted
 * to prevent token-sharing and double-acceptance races. All writes run in a
 * single transaction.
 */
export async function acceptInvitation(args: {
  ctx: ServiceContext;
  input: AcceptInvitationInput;
}): Promise<Workspace> {
  const { ctx } = args;
  const input = AcceptInvitationInput.parse(args.input);

  if (!input.email) {
    throw new UnauthorizedError(
      "You are not authorized to access this resource.",
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
    if (existing.acceptedAt) {
      // Defense in depth — the `isNull(acceptedAt)` predicate above should
      // already filter accepted rows. Kept to preserve the legacy explicit
      // guard in case the where-clause is ever weakened.
      throw new ConflictError("Invitation already accepted.");
    }

    await tx
      .update(invitation)
      .set({ acceptedAt: new Date() })
      .where(eq(invitation.id, input.id));

    await tx.insert(usersToWorkspaces).values({
      userId: input.userId,
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
