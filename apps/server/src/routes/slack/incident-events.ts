import { getLogger } from "@logtape/logtape";
import type { ServiceContext } from "@openstatus/services";
import {
  addIncidentNote,
  getIncidentBySlackChannel,
  isAllowedNoteCreatedAt,
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
import {
  resolveSlackMember,
  resolveSlackMentionNames,
} from "./resolve-slack-user";
import {
  collectMentions,
  mentionLabelsFromText,
  richTextToMarkdown,
} from "./rich-text";
import type { SlackWorkspace } from "./workspace-resolver";

const logger = getLogger(["api-server", "slack", "incident-events"]);

const PIN = "pushpin";
const DONE = "white_check_mark";

type SlackMessage = {
  ts?: string;
  text?: string;
  user?: string;
  blocks?: unknown[];
  attachments?: { text?: string; fallback?: string }[];
};

const NOTHING_TO_COPY = "Nothing to copy from that message.";
const VERB_LAG_MS = 60_000;

/**
 * A Slack `ts` ("1759300000.123456") as the time the message was said, or
 * `undefined` (now) when the verb would reject it as outside its window.
 */
function messageDate(ts: string): Date | undefined {
  const date = new Date(Number(ts) * 1000);
  const now = Date.now();
  // The verb samples its own `now` a moment later; a boundary message must
  // pass both, or the pin would fail instead of falling back to now.
  return isAllowedNoteCreatedAt(date, now) &&
    isAllowedNoteCreatedAt(date, now + VERB_LAG_MS)
    ? date
    : undefined;
}

/** Alert bots post `attachments` with an empty `text`. */
function attachmentsText(message: SlackMessage): string {
  return (message.attachments ?? [])
    .map((a) => a.fallback?.trim() || a.text?.trim() || "")
    .filter(Boolean)
    .join("\n\n");
}

async function noteBody(args: {
  resolved: SlackWorkspace;
  teamId: string;
  slack: WebClient;
  message: SlackMessage;
}): Promise<string> {
  const { resolved, teamId, slack, message } = args;
  const labels = mentionLabelsFromText(message.text);
  const lookedUp = await resolveSlackMentionNames({
    workspace: resolved.workspace,
    teamId,
    slack,
    ...collectMentions(message.blocks),
  });
  // A looked-up name beats the label Slack put in `text`.
  const names = {
    users: new Map([...(labels.users ?? []), ...(lookedUp.users ?? [])]),
    channels: new Map([
      ...(labels.channels ?? []),
      ...(lookedUp.channels ?? []),
    ]),
    usergroups: labels.usergroups,
  };
  const body =
    richTextToMarkdown(message.blocks, names) ?? message.text?.trim() ?? "";
  return body || attachmentsText(message);
}

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
  // A thread reply is not in the channel history; ask the thread for it. The
  // parent always comes back first, so bound the range to the reply itself and
  // leave room for both.
  const replies = await slack.conversations.replies({
    channel,
    ts,
    oldest: ts,
    latest: ts,
    inclusive: true,
    limit: 2,
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
    const key = `slack:pinlink:${channel}:${ts}`;
    const once = await redis.set(key, "1", { nx: true, ex: 24 * 60 * 60 });
    if (once === null) return;
    try {
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
    } catch (err) {
      // Otherwise a transient failure silences the card for the whole window.
      await redis.del(key).catch(() => undefined);
      throw err;
    }
    return;
  }

  // Claimed before the ✅ check so two 📌 racing on one message note it once;
  // it also stands in for the ✅ when adding the reaction fails.
  const claim = `slack:pinned:${channel}:${ts}`;
  const claimed = await redis.set(claim, "1", { nx: true, ex: 24 * 60 * 60 });
  if (claimed === null) return;
  try {
    if (await alreadyNoted(slack, channel, ts, resolved.botUserId)) return;
    const message = await findMessage(slack, channel, ts);
    const body = message
      ? await noteBody({ resolved, teamId, slack, message })
      : "";
    if (!body) {
      await redis.del(claim);
      await slack.chat
        .postEphemeral({
          channel,
          user: slackUserId,
          thread_ts: ts,
          text: NOTHING_TO_COPY,
        })
        .catch((error) =>
          logger.warn("slack failed to report an empty pin", { error }),
        );
      return;
    }
    const permalink = await slack.chat
      .getPermalink({ channel, message_ts: ts })
      .then((res) => res.permalink)
      .catch(() => undefined);
    // The note belongs to whoever said it; bots and unlinked authors fall
    // back to the pinner.
    const author =
      message?.user && message.user !== slackUserId
        ? await resolveSlackMember({
            workspace: resolved.workspace,
            teamId,
            slackUserId: message.user,
            slack,
          })
        : null;

    const ctx: ServiceContext = { workspace: resolved.workspace, actor };
    await addIncidentNote({
      ctx,
      input: {
        id: bound.id,
        message: permalink ? `${body}\n\n[From Slack](${permalink})` : body,
        createdAt: messageDate(ts),
        createdBy: author ?? undefined,
      },
    });
    trackSlackIncident(ctx, "note", { via: "reaction" });
  } catch (err) {
    await redis.del(claim).catch(() => undefined);
    throw err;
  }
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
