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
  planRequiredMessage,
  requireSlackMember,
  type SlackActor,
  slackAgentAllowed,
} from "./require-slack-member";
import {
  resolveSlackMember,
  resolveSlackMentionNames,
} from "./resolve-slack-user";
import { type EphemeralReply, respondLater } from "./response-url";
import {
  collectMentions,
  mentionLabelsFromText,
  richTextToMarkdown,
} from "./rich-text";
import type { SlackWorkspace } from "./workspace-resolver";

const logger = getLogger(["api-server", "slack", "incident-events"]);

/** Callback id of the "Add to incident timeline" message shortcut. */
export const ADD_TO_TIMELINE_CALLBACK = "add_to_incident_timeline";

const PIN = "pushpin";
const DONE = "white_check_mark";

export type SlackMessage = {
  ts?: string;
  text?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  blocks?: unknown[];
  attachments?: { text?: string; fallback?: string }[];
};

const NOTHING_TO_COPY = "Nothing to copy from that message.";
const NOT_AN_INCIDENT =
  "This channel isn't an open incident's channel. Use *Add to incident timeline* or :pushpin: inside the incident's channel.";
const ALREADY_NOTED = "That message is already on the timeline.";
const NOTED = "Added to the timeline.";
const NOTE_FAILED =
  "Couldn't add that message to the timeline. Please try again.";
const PIN_FAILED =
  "Couldn't copy that message to the timeline. Pin it again to retry.";
const VERB_LAG_MS = 60_000;

/**
 * A Slack `ts` ("1759300000.123456") as the time the message was said, or
 * `undefined` (now) when the verb would reject it as outside its window.
 */
function messageDate(ts: string): Date | undefined {
  const date = new Date(Number(ts) * 1000);
  const now = Date.now();
  // The verb samples its own `now` a moment later; a boundary message must
  // pass both, or the note would fail instead of falling back to now.
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

/** The open incident bound to `channel`, if any. */
async function openIncidentIn(
  resolved: SlackWorkspace,
  teamId: string,
  channel: string,
) {
  const bound = await getIncidentBySlackChannel({
    ctx: system(resolved),
    input: { teamId, channelId: channel },
  });
  return bound && !bound.closedAt ? bound : null;
}

type NoteOutcome = "noted" | "unconfirmed" | "already" | "empty";

/**
 * Copies a message onto the incident's timeline and confirms it with ✅,
 * shared by the 📌 reaction and the message shortcut. `unconfirmed` means the
 * note was added but the ✅ wasn't. Throws, with the claim released, when the
 * note could not be added.
 */
async function noteMessage(args: {
  resolved: SlackWorkspace;
  teamId: string;
  slack: WebClient;
  actor: SlackActor;
  incidentId: number;
  slackUserId: string;
  channel: string;
  ts: string;
  loadMessage: () => Promise<SlackMessage | undefined>;
  via: "reaction" | "shortcut";
}): Promise<NoteOutcome> {
  const { resolved, teamId, slack, actor, slackUserId, channel, ts } = args;
  // Claimed before the ✅ check so a 📌 and a click racing on one message
  // note it once; it also stands in for the ✅ when adding the reaction fails.
  const claim = `slack:timeline:${channel}:${ts}`;
  const claimed = await redis.set(claim, "1", { nx: true, ex: 24 * 60 * 60 });
  if (claimed === null) return "already";
  try {
    if (await alreadyNoted(slack, channel, ts, resolved.botUserId)) {
      return "already";
    }
    const message = await args.loadMessage();
    const body = message
      ? await noteBody({ resolved, teamId, slack, message })
      : "";
    if (!body) {
      await redis.del(claim);
      return "empty";
    }
    // The note belongs to whoever said it; bots and unlinked authors fall
    // back to whoever pinned it or ran the shortcut. A lookup hiccup throws
    // rather than attributing the note to the wrong name forever.
    const authorSlackId =
      message?.user &&
      message.user !== slackUserId &&
      !message.bot_id &&
      message.subtype !== "bot_message"
        ? message.user
        : null;
    const [permalink, author] = await Promise.all([
      slack.chat
        .getPermalink({ channel, message_ts: ts })
        .then((res) => res.permalink)
        .catch(() => undefined),
      authorSlackId
        ? resolveSlackMember({
            workspace: resolved.workspace,
            teamId,
            slackUserId: authorSlackId,
            slack,
            strict: true,
          })
        : null,
    ]);

    const ctx: ServiceContext = { workspace: resolved.workspace, actor };
    await addIncidentNote({
      ctx,
      input: {
        id: args.incidentId,
        message: permalink ? `${body}\n\n[From Slack](${permalink})` : body,
        createdAt: messageDate(ts),
        createdBy: author ?? undefined,
      },
    });
    trackSlackIncident(ctx, "note", { via: args.via });
  } catch (err) {
    await redis.del(claim).catch(() => undefined);
    throw err;
  }
  // The ✅ shows everyone the message is on the timeline.
  return slack.reactions
    .add({ channel, timestamp: ts, name: DONE })
    .then((): NoteOutcome => "noted")
    .catch((error) => {
      logger.warn("slack failed to confirm a timeline note", { error });
      return "unconfirmed";
    });
}

/**
 * 📌 on a message in an incident channel copies it onto the timeline. A
 * reaction is ambient, so anything but a real attempt stays silent; a failure
 * throws so Slack retries the event.
 */
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
  const bound = await openIncidentIn(resolved, teamId, channel);
  if (!bound) return;

  const slack = new WebClient(resolved.botToken);
  const tell = (text: string, what: string) =>
    slack.chat
      .postEphemeral({ channel, user: slackUserId, thread_ts: ts, text })
      .catch((error) =>
        logger.warn(`slack failed to report ${what}`, { error }),
      );
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

  try {
    const outcome = await noteMessage({
      resolved,
      teamId,
      slack,
      actor,
      incidentId: bound.id,
      slackUserId,
      channel,
      ts,
      loadMessage: () => findMessage(slack, channel, ts),
      via: "reaction",
    });
    if (outcome === "empty") await tell(NOTHING_TO_COPY, "an empty pin");
  } catch (err) {
    // Slack retries the event, but a lost pin should not go unnoticed if it
    // keeps failing; one notice per message is enough.
    const once = await redis
      .set(`slack:pinfail:${channel}:${ts}`, "1", {
        nx: true,
        ex: 24 * 60 * 60,
      })
      .catch(() => null);
    if (once !== null) await tell(PIN_FAILED, "a lost pin");
    throw err;
  }
}

/**
 * The "Add to incident timeline" message shortcut: the ⋯-menu twin of 📌.
 * The user asked for it, so every outcome but a ✅ is told to them through
 * the shortcut's `response_url`.
 */
export async function handleAddToTimeline(args: {
  resolved: SlackWorkspace;
  config: SlackConfig;
  teamId: string;
  slackUserId: string;
  channel: string;
  message: SlackMessage & { ts: string };
  responseUrl: string;
}): Promise<void> {
  const { resolved, config, teamId, slackUserId, channel, message } = args;
  const reply = (text: string, blocks?: EphemeralReply["blocks"]) =>
    respondLater(args.responseUrl, { text, blocks }).catch((error) =>
      logger.warn("slack failed to answer the timeline shortcut", { error }),
    );

  if (!slackAgentAllowed(resolved.workspace)) {
    await reply(planRequiredMessage(config).text);
    return;
  }
  const bound = await openIncidentIn(resolved, teamId, channel);
  if (!bound) {
    await reply(NOT_AN_INCIDENT);
    return;
  }

  const slack = new WebClient(resolved.botToken);
  const actor = await requireSlackMember({
    workspace: resolved.workspace,
    teamId,
    slackUserId,
    slack,
  });
  if (!actor) {
    const url = await linkAccountUrl(config, {
      workspaceId: resolved.workspace.id,
      teamId,
      slackUserId,
    });
    await reply(LINK_ACCOUNT_TEXT, buildLinkAccountBlocks(url));
    return;
  }

  let outcome: NoteOutcome;
  try {
    outcome = await noteMessage({
      resolved,
      teamId,
      slack,
      actor,
      incidentId: bound.id,
      slackUserId,
      channel,
      ts: message.ts,
      // The shortcut carries the whole message; no need to look it up.
      loadMessage: () => Promise.resolve(message),
      via: "shortcut",
    });
  } catch (err) {
    await reply(NOTE_FAILED);
    throw err;
  }
  if (outcome === "already") await reply(ALREADY_NOTED);
  else if (outcome === "empty") await reply(NOTHING_TO_COPY);
  else if (outcome === "unconfirmed") await reply(NOTED);
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
