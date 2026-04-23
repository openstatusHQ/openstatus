import { and, eq, gte, isNull } from "@openstatus/db";
import { invitation, usersToWorkspaces } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { type ServiceContext, withTransaction } from "../context";
import { LimitExceededError } from "../errors";
import type { Invitation } from "../types";
import { CreateInvitationInput } from "./schemas";

/**
 * "Unlimited" members resolves to this effective cap — matches the legacy
 * behavior in `invitationRouter.create`. Large enough that enterprise plans
 * never brush against it in practice.
 */
const UNLIMITED_MEMBERS_EFFECTIVE_CAP = 420;

/**
 * Invite a user to the caller's workspace.
 *
 * Enforces the `members` plan cap counting both existing workspace members
 * *and* pending (unexpired, unaccepted) invitations — sending a new invite
 * after an old one is still outstanding would otherwise allow the workspace
 * to slip past the cap once both accept.
 */
export async function createInvitation(args: {
  ctx: ServiceContext;
  input: CreateInvitationInput;
}): Promise<Invitation> {
  const { ctx } = args;
  const input = CreateInvitationInput.parse(args.input);

  return withTransaction(ctx, async (tx) => {
    const membersLimit = ctx.workspace.limits.members;
    const effectiveLimit =
      membersLimit === "Unlimited"
        ? UNLIMITED_MEMBERS_EFFECTIVE_CAP
        : membersLimit;

    const [memberRows, openInviteRows] = await Promise.all([
      tx.query.usersToWorkspaces.findMany({
        where: eq(usersToWorkspaces.workspaceId, ctx.workspace.id),
      }),
      tx.query.invitation.findMany({
        where: and(
          eq(invitation.workspaceId, ctx.workspace.id),
          gte(invitation.expiresAt, new Date()),
          isNull(invitation.acceptedAt),
        ),
      }),
    ]);

    if (memberRows.length + openInviteRows.length >= effectiveLimit) {
      throw new LimitExceededError("members", effectiveLimit);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const token = crypto.randomUUID();

    // `role` is not specified here and falls through to the schema
    // default (`member`). Matches the legacy router, which only picked
    // `email` out of the insert schema and never exposed role on the
    // invite surface — specifying it is a future opt-in, not an
    // unintentional regression.
    const row = await tx
      .insert(invitation)
      .values({
        email: input.email,
        expiresAt,
        token,
        workspaceId: ctx.workspace.id,
      })
      .returning()
      .get();

    if (process.env.NODE_ENV === "development") {
      console.log(
        `>>>> Invitation token: http://localhost:3000/invite?token=${token} <<<< `,
      );
    }

    await emitAudit(tx, ctx, {
      action: "invitation.create",
      entityType: "invitation",
      entityId: row.id,
      metadata: { email: input.email },
    });

    return row as Invitation;
  });
}
