import { and, eq, ne } from "@openstatus/db";
import { user, usersToWorkspaces } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import { type DB, type ServiceContext, withTransaction } from "../context";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
} from "../errors";
import { memberRowSnapshot } from "./internal";
import { TransferOwnershipInput } from "./schemas";

type DemoteRole = "admin" | "member";

export type TransferOwnershipResult = {
  fromUserId: number;
  toUserId: number;
  /** For the post-commit emails and the Stripe customer email sync. */
  newOwnerEmail: string;
  formerOwnerRole: DemoteRole;
};

/**
 * Hand ownership of the caller's workspace to another existing member.
 * Immediate, no acceptance step: the target is already a trusted member.
 * The caller is demoted to `member`.
 *
 * Only fires when the actor is an openstatus user, like `deleteMember`.
 * Support transfers for orphaned workspaces go through
 * `transferOwnershipInWorkspace` with a `system` actor instead.
 */
// The role updates and their `member.update` audit rows live in
// `transferOwnershipInWorkspace`; this verb only adds the owner / self guards.
// oxlint-disable-next-line openstatus/services-mutation-guards
export async function transferOwnership(args: {
  ctx: ServiceContext;
  input: TransferOwnershipInput;
}): Promise<TransferOwnershipResult> {
  const { ctx } = args;
  requireScope(ctx, "admin");
  const input = TransferOwnershipInput.parse(args.input);

  if (ctx.actor.type !== "user") {
    throw new PreconditionFailedError(
      "Only user actors can transfer workspace ownership",
    );
  }
  const callerId = ctx.actor.userId;

  return withTransaction(ctx, async (tx) => {
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
        "Only the workspace owner can transfer ownership",
      );
    }

    if (input.userId === callerId) {
      throw new PreconditionFailedError(
        "Cannot transfer ownership to yourself",
      );
    }

    return transferOwnershipInWorkspace({
      tx,
      ctx,
      fromUserId: callerId,
      toUserId: input.userId,
      demoteTo: "member",
    });
  });
}

/**
 * Shared promote/demote+audit body for an ownership transfer. Not
 * re-exported from the entity index: the public verb and the support
 * script are its only callers.
 *
 * No authorization guard of its own — callers own that. Promotes before it
 * demotes, so the workspace never passes through a zero-owner state even
 * inside the transaction. The demote is conditional on `role = 'owner'`:
 * two concurrent transfers by the same owner resolve to one winner, the
 * other throws `ConflictError` and its promote rolls back.
 *
 * Other owners (legacy multi-owner workspaces) are left untouched.
 */
export async function transferOwnershipInWorkspace(args: {
  tx: DB;
  ctx: ServiceContext;
  fromUserId: number;
  toUserId: number;
  demoteTo: DemoteRole;
}): Promise<TransferOwnershipResult> {
  const { tx, ctx, fromUserId, toUserId, demoteTo } = args;
  const workspaceId = ctx.workspace.id;

  const target = await tx
    .select({
      role: usersToWorkspaces.role,
      email: user.email,
      deletedAt: user.deletedAt,
    })
    .from(usersToWorkspaces)
    .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
    .where(
      and(
        eq(usersToWorkspaces.userId, toUserId),
        eq(usersToWorkspaces.workspaceId, workspaceId),
      ),
    )
    .get();

  if (!target) {
    throw new NotFoundError("membership", toUserId);
  }
  if (target.deletedAt || !target.email) {
    throw new PreconditionFailedError("This user cannot own a workspace");
  }
  if (target.role === "owner") {
    throw new ConflictError("User is already an owner of this workspace");
  }

  const [promoted] = await tx
    .update(usersToWorkspaces)
    .set({ role: "owner" })
    .where(
      and(
        eq(usersToWorkspaces.userId, toUserId),
        eq(usersToWorkspaces.workspaceId, workspaceId),
        ne(usersToWorkspaces.role, "owner"),
      ),
    )
    .returning();

  if (!promoted) {
    throw new ConflictError("User is already an owner of this workspace");
  }

  const [demoted] = await tx
    .update(usersToWorkspaces)
    .set({ role: demoteTo })
    .where(
      and(
        eq(usersToWorkspaces.userId, fromUserId),
        eq(usersToWorkspaces.workspaceId, workspaceId),
        eq(usersToWorkspaces.role, "owner"),
      ),
    )
    .returning();

  if (!demoted) {
    // Another request already demoted the former owner; throwing rolls back
    // the promote above.
    throw new ConflictError("Ownership was changed by another request");
  }

  const metadata = {
    reason: "ownership_transfer" as const,
    fromUserId,
    toUserId,
  };

  // New owner first, former owner second: reads sort newest first, so the
  // former owner's row shows on top.
  await emitAudit(tx, ctx, {
    action: "member.update",
    entityType: "member",
    entityId: toUserId,
    before: memberRowSnapshot.parse({ ...promoted, role: target.role }),
    after: memberRowSnapshot.parse(promoted),
    metadata,
  });
  await emitAudit(tx, ctx, {
    action: "member.update",
    entityType: "member",
    entityId: fromUserId,
    before: memberRowSnapshot.parse({ ...demoted, role: "owner" }),
    after: memberRowSnapshot.parse(demoted),
    metadata,
  });

  return {
    fromUserId,
    toUserId,
    newOwnerEmail: target.email,
    formerOwnerRole: demoteTo,
  };
}
