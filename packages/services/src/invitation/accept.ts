import { and, eq, gte, isNull } from "@openstatus/db";
import {
  invitation,
  selectWorkspaceSchema,
  usersToWorkspaces,
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
    // Load the invitation with its workspace in one round-trip — we use
    // `existing.workspace` for the service's return value, so there's
    // no point re-fetching it by id afterwards. Keeping a single read
    // also avoids a read-skew window where a just-renamed workspace
    // would appear with one name on the db fetch and another on the
    // relation join.
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
    // write a no-op for any row another caller has already claimed,
    // even if both callers passed the read check above. Rowcount == 0
    // means we lost the race. The `gte(expiresAt, now)` condition is
    // re-asserted here to close a TOCTOU gap: without it, an invitation
    // whose expiry is exactly the moment between the read and the write
    // can be silently accepted past the deadline.
    const acceptedAt = new Date();
    const claimed = await tx
      .update(invitation)
      .set({ acceptedAt })
      .where(
        and(
          eq(invitation.id, input.id),
          isNull(invitation.acceptedAt),
          gte(invitation.expiresAt, new Date()),
        ),
      )
      .returning({ id: invitation.id });

    if (claimed.length === 0) {
      throw new ConflictError("Invitation already accepted.");
    }

    // `onConflictDoNothing` keyed on the `(userId, workspaceId)` unique
    // constraint — idempotent for an invitee who's already a member of
    // the target workspace (e.g. they were added directly before the
    // invitation token was redeemed). Without this the final insert
    // explodes on the unique violation after the invitation row was
    // already stamped accepted, leaving the token consumed with no
    // membership change the caller can distinguish from success.
    await tx
      .insert(usersToWorkspaces)
      .values({
        userId,
        workspaceId: existing.workspaceId,
        role: existing.role,
      })
      .onConflictDoNothing();

    if (!existing.workspace) {
      throw new NotFoundError("workspace", existing.workspaceId);
    }

    // Strip `token` (email-link capability) from the snapshot; construct the snapshots from the pre-fetched row
    // to avoid a second SELECT after the UPDATE.
    const { token: _token, ...before } = existing;
    await emitAudit(tx, ctx, {
      action: "invitation.update",
      entityType: "invitation",
      entityId: input.id,
      before,
      after: { ...before, acceptedAt },
    });

    return selectWorkspaceSchema.parse(existing.workspace);
  });
}
