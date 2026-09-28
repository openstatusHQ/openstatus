import { getLogger } from "@logtape/logtape";
import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import type { ServiceContext } from "@openstatus/services";
import { findMemberIdByEmail } from "@openstatus/services/member";
import {
  createSlackUserMapping,
  getSlackUserMapping,
} from "@openstatus/services/slack-user";
import type { WebClient } from "@slack/web-api";

const logger = getLogger(["api-server", "slack", "resolve-user"]);

/**
 * The openstatus member linked to a Slack user, or `null`. A missing link is
 * created on the spot when the Slack profile email matches exactly one member.
 */
export async function resolveSlackMember(args: {
  workspace: Workspace;
  teamId: string;
  slackUserId: string;
  slack: WebClient;
}): Promise<number | null> {
  const { workspace, teamId, slackUserId, slack } = args;
  if (!teamId || !slackUserId) return null;

  const ctx: ServiceContext = {
    workspace,
    actor: { type: "system", job: "slack-user-automap" },
  };
  try {
    const linked = await getSlackUserMapping({
      ctx,
      input: { teamId, slackUserId },
    });
    if (linked !== null) return linked;

    const info = await slack.users.info({ user: slackUserId });
    const email = info.user?.profile?.email;
    if (!email) return null;
    const userId = await findMemberIdByEmail({ ctx, input: { email } });
    if (userId === null) return null;
    await createSlackUserMapping({
      ctx,
      input: { teamId, slackUserId, userId },
    });
    return userId;
  } catch (err) {
    logger.warn("slack user resolution failed", {
      workspaceId: workspace.id,
      teamId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
