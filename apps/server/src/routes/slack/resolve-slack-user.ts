import { getLogger } from "@logtape/logtape";
import type { Workspace } from "@openstatus/db/src/schema/workspaces/validation";
import type { ServiceContext } from "@openstatus/services";
import {
  findMemberIdByEmail,
  getMemberDisplayName,
} from "@openstatus/services/member";
import {
  createSlackUserMapping,
  getSlackUserMapping,
} from "@openstatus/services/slack-user";
import type { WebClient } from "@slack/web-api";

import type { MentionNames } from "./rich-text";

const logger = getLogger(["api-server", "slack", "resolve-user"]);

/** One `users.info` serves both the email match and the fallback name. */
async function lookupSlackMember(args: {
  workspace: Workspace;
  teamId: string;
  slackUserId: string;
  slack: WebClient;
}): Promise<{ userId: number | null; profileName: string | null }> {
  const { workspace, teamId, slackUserId, slack } = args;
  if (!teamId || !slackUserId) return { userId: null, profileName: null };

  const ctx: ServiceContext = {
    workspace,
    actor: { type: "system", job: "slack-user-automap" },
  };
  let profileName: string | null = null;
  try {
    const linked = await getSlackUserMapping({
      ctx,
      input: { teamId, slackUserId },
    });
    if (linked !== null) return { userId: linked, profileName };

    const info = await slack.users.info({ user: slackUserId });
    profileName =
      info.user?.profile?.display_name ||
      info.user?.real_name ||
      info.user?.name ||
      null;
    const email = info.user?.profile?.email;
    if (!email) return { userId: null, profileName };
    const userId = await findMemberIdByEmail({ ctx, input: { email } });
    if (userId === null) return { userId: null, profileName };
    await createSlackUserMapping({
      ctx,
      input: { teamId, slackUserId, userId },
    });
    return { userId, profileName };
  } catch (err) {
    logger.warn("slack user resolution failed", {
      workspaceId: workspace.id,
      teamId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { userId: null, profileName };
  }
}

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
  return (await lookupSlackMember(args)).userId;
}

// A pinned message rarely mentions more than a handful of people.
const MAX_MENTIONS = 20;

/**
 * Names for the users and channels a message mentions: a linked member's
 * openstatus name, else the Slack profile name, else nothing (the caller
 * keeps the raw id). Lookups that fail are dropped, never thrown.
 */
export async function resolveSlackMentionNames(args: {
  workspace: Workspace;
  teamId: string;
  slack: WebClient;
  users: string[];
  channels: string[];
}): Promise<MentionNames> {
  const { workspace, teamId, slack } = args;
  const ctx: ServiceContext = {
    workspace,
    actor: { type: "system", job: "slack-user-automap" },
  };
  const users = new Map<string, string>();
  const channels = new Map<string, string>();

  await Promise.all([
    ...args.users.slice(0, MAX_MENTIONS).map(async (slackUserId) => {
      const { userId, profileName } = await lookupSlackMember({
        workspace,
        teamId,
        slackUserId,
        slack,
      });
      const memberName =
        userId === null
          ? null
          : await getMemberDisplayName({ ctx, input: { userId } }).catch(
              () => null,
            );
      const name = memberName ?? profileName;
      if (name) users.set(slackUserId, name);
    }),
    ...args.channels.slice(0, MAX_MENTIONS).map(async (channelId) => {
      const res = await slack.conversations
        .info({ channel: channelId })
        .catch(() => undefined);
      const name = res?.channel?.name;
      if (name) channels.set(channelId, name);
    }),
  ]);

  return { users, channels };
}
