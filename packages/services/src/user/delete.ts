import { and, eq, ne } from "@openstatus/db";
import {
  account,
  session,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import { ForbiddenError, UnauthorizedError } from "../errors";
import { DeleteAccountInput } from "./schemas";

/**
 * Soft-delete a user account:
 * 1. Refuses to proceed if the user owns a workspace on a paid plan — they
 *    must cancel the subscription first. (Legacy behavior; preserves the
 *    revenue guardrail.)
 * 2. Removes their membership from every workspace they don't own.
 * 3. Deletes their sessions and OAuth accounts.
 * 4. Blanks out PII on the user row and stamps `deletedAt`.
 *
 * All four writes run in a single transaction so a partial failure never
 * leaves the account half-deleted.
 *
 * **Scope note — owned workspaces are not cleaned up here.** The user's
 * `usersToWorkspaces` rows where `role === "owner"` survive, along with
 * every workspace / monitor / page they own. Since only free-plan users
 * reach this path (the paid-plan guard above), the outcome is an
 * orphaned free workspace with no active owner, which matches the
 * legacy router behavior. Workspace-level cleanup (reclaim slots, tombstone
 * unowned free workspaces) is explicitly out of scope for this service —
 * if/when it lands, it'll be a separate admin / scheduled job rather
 * than inline here.
 */
export async function deleteAccount(args: {
  ctx: ServiceContext;
  input?: DeleteAccountInput;
}): Promise<void> {
  const { ctx } = args;
  if (args.input !== undefined) DeleteAccountInput.parse(args.input);

  // `userId` is derived from `ctx.actor`, not input — account deletion
  // is strictly self-service and must target the authenticated user,
  // never an arbitrary id supplied by the caller. Matches the same
  // pattern established by `acceptInvitation` / `createApiKey`.
  const userId = tryGetActorUserId(ctx.actor);
  if (userId == null) {
    throw new UnauthorizedError(
      "Account deletion requires a known user actor.",
    );
  }

  await withTransaction(ctx, async (tx) => {
    const ownedRows = await tx.query.usersToWorkspaces.findMany({
      where: and(
        eq(usersToWorkspaces.userId, userId),
        eq(usersToWorkspaces.role, "owner"),
      ),
      with: { workspace: true },
    });

    const hasPaidWorkspace = ownedRows.some(
      ({ workspace }) => workspace.plan && workspace.plan !== "free",
    );

    if (hasPaidWorkspace) {
      throw new ForbiddenError(
        "You must cancel your subscription before deleting your account.",
      );
    }

    await tx
      .delete(usersToWorkspaces)
      .where(
        and(
          eq(usersToWorkspaces.userId, userId),
          ne(usersToWorkspaces.role, "owner"),
        ),
      );

    await tx.delete(session).where(eq(session.userId, userId));
    await tx.delete(account).where(eq(account.userId, userId));

    await tx
      .update(user)
      .set({
        deletedAt: new Date(),
        email: "",
        firstName: "",
        lastName: "",
        photoUrl: "",
        name: "",
      })
      .where(eq(user.id, userId));

    await emitAudit(tx, ctx, {
      action: "user.delete_account",
      entityType: "user",
      entityId: userId,
    });
  });
}
