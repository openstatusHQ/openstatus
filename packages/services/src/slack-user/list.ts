import { and, eq } from "@openstatus/db";
import { type SlackUser, slackUser } from "@openstatus/db/src/schema";

import { requireScope } from "../auth";
import { type ServiceContext, getReadDb, tryGetActorUserId } from "../context";

/** The Slack accounts linked to the calling user in this workspace. */
export async function listSlackUserMappings(args: {
  ctx: ServiceContext;
}): Promise<SlackUser[]> {
  requireScope(args.ctx, "admin");
  const { ctx } = args;
  const userId = tryGetActorUserId(ctx.actor);
  if (userId === null) return [];
  return getReadDb(ctx)
    .select()
    .from(slackUser)
    .where(
      and(
        eq(slackUser.workspaceId, ctx.workspace.id),
        eq(slackUser.userId, userId),
      ),
    )
    .all();
}
