import { and, eq, isNull } from "@openstatus/db";
import { slackUser, user, usersToWorkspaces } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { GetSlackUserMappingInput } from "./schemas";

/**
 * The openstatus user a Slack user is linked to, or `null`. Only a current,
 * non-deleted member of the workspace counts, so a stale row never authorizes.
 */
export async function getSlackUserMapping(args: {
  ctx: ServiceContext;
  input: GetSlackUserMappingInput;
}): Promise<number | null> {
  const input = GetSlackUserMappingInput.parse(args.input);
  const row = await getReadDb(args.ctx)
    .select({ userId: slackUser.userId })
    .from(slackUser)
    .innerJoin(
      usersToWorkspaces,
      and(
        eq(usersToWorkspaces.userId, slackUser.userId),
        eq(usersToWorkspaces.workspaceId, slackUser.workspaceId),
      ),
    )
    .innerJoin(user, eq(user.id, slackUser.userId))
    .where(
      and(
        eq(slackUser.workspaceId, args.ctx.workspace.id),
        eq(slackUser.slackTeamId, input.teamId),
        eq(slackUser.slackUserId, input.slackUserId),
        isNull(user.deletedAt),
      ),
    )
    .get();
  return row?.userId ?? null;
}
