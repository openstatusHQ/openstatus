import { and, eq } from "@openstatus/db";
import { usersToWorkspaces } from "@openstatus/db/src/schema";
import { z } from "zod";

import { emitAudit } from "../audit";
import { type DB, type ServiceContext } from "../context";

// Composite-PK rows: drizzle's createSelectSchema would flatten the join,
// but the membership row has no auto-generated columns we'd want to drop
// from a snapshot. Inline parser keeps the audit `before` shape stable
// even if a column is added to `users_to_workspaces` later.
export const memberRowSnapshot = z.object({
  userId: z.number(),
  workspaceId: z.number(),
  role: z.string(),
  createdAt: z.coerce.date().nullable(),
});

/**
 * Shared delete+audit body for a single membership row — the sole place
 * the `member.delete` write lives. `deleteMember` wraps this with its
 * owner-actor / self-removal guards; the Stripe downgrade cascade calls it
 * directly as a `system` actor. This is an extraction, not a duplicate:
 * the guard-bearing entry point (`deleteMember`) delegates here so the two
 * callers can't drift on the workspace-scoping or the audit snapshot.
 *
 * No authorization guard of its own — callers own that. Idempotent on the
 * target row: a missing membership deletes nothing and emits no audit row.
 */
export async function removeMemberInWorkspace(args: {
  tx: DB;
  ctx: ServiceContext;
  userId: number;
}): Promise<void> {
  const { tx, ctx, userId } = args;

  const [removed] = await tx
    .delete(usersToWorkspaces)
    .where(
      and(
        eq(usersToWorkspaces.workspaceId, ctx.workspace.id),
        eq(usersToWorkspaces.userId, userId),
      ),
    )
    .returning();

  if (!removed) return;

  await emitAudit(tx, ctx, {
    action: "member.delete",
    entityType: "member",
    entityId: userId,
    before: memberRowSnapshot.parse(removed),
  });
}
