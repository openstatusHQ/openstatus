import { getLogger } from "@logtape/logtape";
import type { ServiceContext } from "@openstatus/services";
import {
  addIncidentNote,
  getIncidentBySlackChannel,
  unbindIncidentSlackChannel,
} from "@openstatus/services/incident";
import { WebClient } from "@slack/web-api";

import { redis } from "@/libs/clients";

import { buildLinkAccountBlocks, LINK_ACCOUNT_TEXT } from "./blocks";
import type { SlackConfig } from "./config";
import { trackSlackIncident } from "./incident-analytics";
import {
  linkAccountUrl,
  requireSlackMember,
  slackAgentAllowed,
} from "./require-slack-member";
import type { SlackWorkspace } from "./workspace-resolver";

const logger = getLogger(["api-server", "slack", "incident-events"]);

const PIN = "pushpin";
const DONE = "white_check_mark";

type SlackMessage = { ts?: string; text?: string; user?: string };

function system(resolved: SlackWorkspace): ServiceContext {
  return {
    workspace: resolved.workspace,
    actor: { type: "system", job: "slack-incident-events" },
  };
}

async function findMessage(
  slack: WebClient,
  channel: string,
  ts: string,
): Promise<SlackMessage | undefined> {
  const history = await slack.conversations.history({
    channel,
    latest: ts,
    inclusive: true,
    limit: 1,
  });
  const top = (history.messages ?? []).find((m) => m.ts === ts);
  if (top) return top;
  // A thread reply is not in the channel history; ask the thread for it.
  const replies = await slack.conversations.replies({
    channel,
    ts,
    latest: ts,
    inclusive: true,
    limit: 1,
  });
  return (replies.messages ?? []).find((m) => m.ts === ts);
}

async function alreadyNoted(
  slack: WebClient,
  channel: string,
  ts: string,
  botUserId: string,
): Promise<boolean> {
  const res = await slack.reactions.get({ channel, timestamp: ts });
  return (res.message?.reactions ?? []).some(
    (r) => r.name === DONE && (r.users ?? []).includes(botUserId),
  );
}

/** 📌 on a message in an incident channel copies it onto the timeline. */
export async function handlePinReaction(args: {
  resolved: SlackWorkspace;
  config: SlackConfig;
  teamId: string;
  slackUserId: string;
  reaction: string;
  channel: string;
  ts: string;
}): Promise<void> {
  const { resolved, config, teamId, slackUserId, channel, ts } = args;
  if (args.reaction !== PIN) return;
  if (!slackAgentAllowed(resolved.workspace)) return;
  const bound = await getIncidentBySlackChannel({
    ctx: system(resolved),
    input: { teamId, channelId: channel },
  });
  if (!bound || bound.closedAt) return;

  const slack = new WebClient(resolved.botToken);
  const actor = await requireSlackMember({
    workspace: resolved.workspace,
    teamId,
    slackUserId,
    slack,
  });
  if (!actor) {
    const once = await redis.set(`slack:pinlink:${channel}:${ts}`, "1", {
      nx: true,
      ex: 24 * 60 * 60,
    });
    if (once === null) return;
    const url = await linkAccountUrl(config, {
      workspaceId: resolved.workspace.id,
      teamId,
      slackUserId,
    });
    await slack.chat.postEphemeral({
      channel,
      user: slackUserId,
      thread_ts: ts,
      text: LINK_ACCOUNT_TEXT,
      blocks: buildLinkAccountBlocks(url),
    });
    return;
  }

  if (await alreadyNoted(slack, channel, ts, resolved.botUserId)) return;
  const message = await findMessage(slack, channel, ts);
  if (!message?.text) return;
  const permalink = await slack.chat
    .getPermalink({ channel, message_ts: ts })
    .then((res) => res.permalink)
    .catch(() => undefined);

  const ctx: ServiceContext = { workspace: resolved.workspace, actor };
  await addIncidentNote({
    ctx,
    input: {
      id: bound.id,
      message: permalink
        ? `${message.text}\n\n[From Slack](${permalink})`
        : message.text,
    },
  });
  trackSlackIncident(ctx, "note", { via: "reaction" });
  await slack.reactions
    .add({ channel, timestamp: ts, name: DONE })
    .catch((error) => logger.warn("slack failed to confirm pin", { error }));
}

/** An archived or deleted channel no longer carries its incident. */
export async function handleChannelGone(args: {
  resolved: SlackWorkspace;
  teamId: string;
  channel: string;
  slackUserId: string | undefined;
}): Promise<void> {
  const { resolved, teamId, channel } = args;
  const bound = await getIncidentBySlackChannel({
    ctx: system(resolved),
    input: { teamId, channelId: channel },
  });
  if (!bound) return;
  const actor = args.slackUserId
    ? await requireSlackMember({
        workspace: resolved.workspace,
        teamId,
        slackUserId: args.slackUserId,
        slack: new WebClient(resolved.botToken),
      })
    : null;
  await unbindIncidentSlackChannel({
    ctx: actor ? { workspace: resolved.workspace, actor } : system(resolved),
    input: { id: bound.id },
  });
  logger.info("slack incident channel unbound", { incidentId: bound.id });
}
