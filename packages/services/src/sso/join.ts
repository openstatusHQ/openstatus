import { usersToWorkspaces } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type ServiceContext, withTransaction } from "../context";
import { ForbiddenError } from "../errors";
import { memberRowSnapshot } from "../member/internal";
import { JoinSsoWorkspaceInput } from "./schemas";

/**
 * Just-in-time provisioning for an SSO sign-in: add the asserted user to the
 * workspace as a `member`.
 *
 * The caller must already have authorized the sign-in — this verb only
 * re-asserts that the workspace still has SSO switched on, so a workspace that
 * disabled SSO between the IdP callback and this write can't be joined.
 *
 * `onConflictDoNothing` on the `(userId, workspaceId)` unique constraint keeps
 * repeat logins idempotent, which also means SSO never demotes an existing
 * owner. The audit row is emitted only when a membership was actually created,
 * so routine logins don't flood the log.
 */
export async function joinSsoWorkspace(args: {
  ctx: ServiceContext;
  input: JoinSsoWorkspaceInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
  const input = JoinSsoWorkspaceInput.parse(args.input);

  if (!ctx.workspace.ssoEnabled) {
    throw new ForbiddenError("SSO is not enabled for this workspace");
  }

  await withTransaction(ctx, async (tx) => {
    const [created] = await tx
      .insert(usersToWorkspaces)
      .values({
        userId: input.userId,
        workspaceId: ctx.workspace.id,
        role: "member",
      })
      .onConflictDoNothing()
      .returning();

    if (!created) return;

    await emitAudit(tx, ctx, {
      action: "member.create",
      entityType: "member",
      entityId: input.userId,
      after: memberRowSnapshot.parse(created),
      metadata: { provisionedVia: "sso" },
    });
  });
}
