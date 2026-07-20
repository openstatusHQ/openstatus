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
 * Delete a single membership row (workspace-scoped) and emit
 * `member.delete` inside the caller's transaction. No authorization guard
 * — callers enforce their own: `deleteMember` requires an owner actor,
 * the Stripe downgrade cascade runs as `system`. Idempotent on the target
 * row: a missing membership deletes nothing and emits no audit row.
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
