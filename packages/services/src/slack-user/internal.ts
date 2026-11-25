import { and, eq } from "@openstatus/db";
import { slackUser } from "@openstatus/db/src/schema";

import { emitAudit } from "../audit";
import type { DB, ServiceContext } from "../context";

export async function deleteSlackUserMappings(args: {
  tx: DB;
  ctx: ServiceContext;
  where: { userId: number } | { slackTeamId: string } | { id: number };
}): Promise<number> {
  const { tx, ctx, where } = args;
  const filter =
    "userId" in where
      ? eq(slackUser.userId, where.userId)
      : "slackTeamId" in where
        ? eq(slackUser.slackTeamId, where.slackTeamId)
        : eq(slackUser.id, where.id);

  const removed = await tx
    .delete(slackUser)
    .where(and(eq(slackUser.workspaceId, ctx.workspace.id), filter))
    .returning();

  for (const row of removed) {
    await emitAudit(tx, ctx, {
      action: "slack_user.delete",
      entityType: "slack_user",
      entityId: row.id,
      before: row,
      metadata: { slackTeamId: row.slackTeamId, userId: row.userId },
    });
  }
  return removed.length;
}
