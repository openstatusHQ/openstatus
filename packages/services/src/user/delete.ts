import { and, count, eq, isNull, ne } from "@openstatus/db";
import {
  account,
  monitor,
  notification,
  page,
  selectWorkspaceSchema,
  session,
  user,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import { requireScope } from "../auth";
import {
  type ServiceContext,
  tryGetActorUserId,
  withTransaction,
} from "../context";
import {
  NotFoundError,
  PreconditionFailedError,
  UnauthorizedError,
} from "../errors";
import { deleteMonitors } from "../monitor/delete";
import { deleteNotification } from "../notification/delete";
import { deletePage } from "../page/delete";
import { DeleteAccountInput } from "./schemas";

/**
 * Soft-delete a user account:
 * 1. Refuses to proceed if the user owns a workspace on a paid plan — they
 *    must cancel the subscription first. (Legacy behavior; preserves the
 *    revenue guardrail.)
 * 2. For every owned workspace where this user is the only remaining
 *    member, soft-deletes the monitors and deletes the pages and
 *    notifications so we don't keep running probes / sending alerts for
 *    an unreachable owner. The workspace row and the owner membership
 *    are intentionally left in place; reclaiming those is out of scope.
 * 3. Removes their membership from every workspace they don't own.
 * 4. Deletes their sessions and OAuth accounts.
 * 5. Blanks out PII on the user row and stamps `deletedAt`.
 *
 * All writes run in a single transaction so a partial failure never
 * leaves the account half-deleted.
 */
export async function deleteAccount(args: {
  ctx: ServiceContext;
  input?: DeleteAccountInput;
}): Promise<void> {
  const { ctx } = args;
  requireScope(ctx, "write");
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
    const existing = await tx.query.user.findFirst({
      where: eq(user.id, userId),
    });

    // Actor's user id resolved to nothing — anomalous, don't proceed
    // silently and don't emit an audit row for a phantom delete.
    if (!existing) throw new NotFoundError("user", userId);

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
      // `PreconditionFailedError` (maps to tRPC `PRECONDITION_FAILED`)
      // rather than `ForbiddenError` — the pre-migration tRPC handler
      // used `PRECONDITION_FAILED` for this case so the UI could
      // distinguish "missing permissions" from "missing prerequisite
      // state" and render a different copy ("cancel your subscription
      // first"). Collapsing both to `FORBIDDEN` via generic service-
      // error mapping regressed the distinction.
      throw new PreconditionFailedError(
        "You must cancel your subscription before deleting your account.",
      );
    }

    for (const { workspace: rawWorkspace } of ownedRows) {
      const others = await tx
        .select({ c: count() })
        .from(usersToWorkspaces)
        .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
        .where(
          and(
            eq(usersToWorkspaces.workspaceId, rawWorkspace.id),
            ne(usersToWorkspaces.userId, userId),
            isNull(user.deletedAt),
          ),
        )
        .get();
      if ((others?.c ?? 0) > 0) continue;

      // Sub-context targets the orphaned workspace so audit rows
      // land under the right `workspace_id` and the per-entity
      // services pass their `workspaceId` scoping checks. The same
      // `tx` is threaded through so everything still rolls back as
      // one unit if any cleanup step fails.
      const subCtx: ServiceContext = {
        ...ctx,
        workspace: selectWorkspaceSchema.parse(rawWorkspace),
        db: tx,
      };

      const monitorIds = (
        await tx
          .select({ id: monitor.id })
          .from(monitor)
          .where(
            and(
              eq(monitor.workspaceId, rawWorkspace.id),
              isNull(monitor.deletedAt),
            ),
          )
          .all()
      ).map((m) => m.id);
      if (monitorIds.length > 0) {
        await deleteMonitors({ ctx: subCtx, input: { ids: monitorIds } });
      }

      const pageIds = (
        await tx
          .select({ id: page.id })
          .from(page)
          .where(eq(page.workspaceId, rawWorkspace.id))
          .all()
      ).map((p) => p.id);
      for (const id of pageIds) {
        await deletePage({ ctx: subCtx, input: { id } });
      }

      const notificationIds = (
        await tx
          .select({ id: notification.id })
          .from(notification)
          .where(eq(notification.workspaceId, rawWorkspace.id))
          .all()
      ).map((n) => n.id);
      for (const id of notificationIds) {
        await deleteNotification({ ctx: subCtx, input: { id } });
      }
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
      action: "user.delete",
      entityType: "user",
      entityId: userId,
      before: existing,
    });
  });
}
