import { getLogger } from "@logtape/logtape";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { integration, pageSubscriber } from "@openstatus/db/src/schema";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { z } from "zod";

import { runAgent } from "./agent";
import {
  setAssistantStatus,
  setSessionStatus,
  startAssistantThread,
} from "./assistant";
import {
  type Block,
  buildConfirmationBlocks,
  getConfirmationText,
  type RefResolvers,
} from "./blocks";
import { findByThread, replace, store } from "./confirmation-store";
import type { PendingPayload } from "./confirmation-store";
import { publishHomeView } from "./home";
import { toMrkdwn } from "./mrkdwn";
import {
  getComponentNames,
  getPageDashboardLink,
  getStatusReportLink,
} from "./page-urls";
import { getRegistryTool, isSlackToolDraft } from "./registry-runner";
import { resolveWorkspace } from "./workspace-resolver";

function makeRefResolvers(workspaceId: number): RefResolvers {
  return {
    page: (pageId) => getPageDashboardLink(workspaceId, pageId),
    statusReport: (statusReportId) =>
      getStatusReportLink(workspaceId, statusReportId),
    componentNames: (ids) => getComponentNames(workspaceId, ids),
  };
}

const logger = getLogger("api-server");

const processedEvents = new Map<string, number>();

function dedup(eventId: string): boolean {
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > 300_000) processedEvents.delete(id);
  }
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, now);
  return false;
}

const slackEventSchema = z.object({
  type: z.string(),
  event: z
    .object({
      type: z.string(),
      subtype: z.string().optional(),
      text: z.string().optional(),
      user: z.string().optional(),
      channel: z.string().optional(),
      channel_type: z.string().optional(),
      ts: z.string().optional(),
      thread_ts: z.string().optional(),
      bot_id: z.string().optional(),
      tab: z.string().optional(),
      assistant_thread: z
        .object({
          channel_id: z.string(),
          thread_ts: z.string(),
        })
        .optional(),
    })
    .optional(),
  event_id: z.string().optional(),
  team_id: z.string().optional(),
  challenge: z.string().optional(),
});

type SlackEvent = z.infer<typeof slackEventSchema>;

const threadMessageSchema = z.object({
  user: z.string().optional(),
  bot_id: z.string().optional(),
  text: z.string().optional(),
  ts: z.string().optional(),
});

type ThreadMessage = z.infer<typeof threadMessageSchema>;

const slackPlatformErrorSchema = z.object({
  code: z.literal("slack_webapi_platform_error"),
  data: z.object({
    error: z.string(),
  }),
});

function isSlackPlatformError(err: unknown, errorCode: string): boolean {
  const parsed = slackPlatformErrorSchema.safeParse(err);
  return parsed.success && parsed.data.data.error === errorCode;
}

// Asking permission to run a write tool ("shall I go ahead and publish this?").
const PERMISSION_QUESTION =
  /\b(shall i|should i|do you want me to|would you like me to|want me to|ready for me to|can i)\b[^?]*\b(go ahead|proceed|publish|create|post|send|schedule|submit|add|resolve|update)\b/i;

// A change written out as message text rather than passed to a tool.
const PROSE_DRAFT_FIELDS =
  /\*{0,2}(title|status|message|impact|components?|from|to)\*{0,2}\s*:/gi;

/**
 * Heuristic for the "model drafted in prose instead of calling the tool" failure
 * — logging only, so false positives are cheap. Both signals are required: a
 * plain answer can end in a question, and a list of reports can look tabular.
 */
export function looksLikeUncardedDraft(text: string): boolean {
  if (!text) return false;
  if (!PERMISSION_QUESTION.test(text)) return false;
  return (text.match(PROSE_DRAFT_FIELDS) ?? []).length >= 2;
}

// Bounds the Slack calls (and the agent's context) on very long threads.
const MAX_THREAD_PAGES = 5;

// Replies come oldest first, so a single page would miss the latest messages
// of a long thread — the ones the agent is being asked about.
async function fetchThread(
  slack: WebClient,
  channel: string,
  threadTs: string,
): Promise<ThreadMessage[]> {
  const messages: ThreadMessage[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_THREAD_PAGES; page++) {
    const replies = await slack.conversations.replies({
      channel,
      ts: threadTs,
      limit: 100,
      cursor,
    });
    messages.push(...((replies.messages ?? []) as ThreadMessage[]));
    cursor = replies.response_metadata?.next_cursor || undefined;
    if (!replies.has_more || !cursor) break;
  }
  return messages;
}

/**
 * Whether an untagged channel-thread message is the user answering the agent
 * (e.g. "API" after "Which status page — API or Marketing?"). True only when
 * the agent posted the message right before it and its author is whoever first
 * mentioned the agent in the thread. Anything else still needs a mention, so
 * the agent stays out of the humans' side of an incident thread.
 */
export function isAnswerToAgent(
  thread: ThreadMessage[],
  message: { ts: string; user?: string },
  botUserId: string,
): boolean {
  if (!message.user || !botUserId) return false;
  const index = thread.findIndex((m) => m.ts === message.ts);
  const earlier = index === -1 ? thread : thread.slice(0, index);

  const previous = earlier.at(-1);
  if (previous?.user !== botUserId) return false;

  const starter = earlier.find(
    (m) => m.user !== botUserId && m.text?.includes(`<@${botUserId}>`),
  );
  return starter?.user === message.user;
}

export async function handleSlackEvent(c: Context) {
  const body = c.get("slackBody") as SlackEvent;

  if (body.type === "url_verification") {
    return c.json({ challenge: body.challenge });
  }

  if (body.type !== "event_callback") {
    return c.json({ ok: true });
  }

  if (body.event_id && dedup(body.event_id)) {
    return c.json({ ok: true });
  }

  const promise = processEvent(body);
  promise.catch((err) =>
    logger.error("slack event processing error", {
      error: err,
      teamId: body.team_id,
      eventId: body.event_id,
    }),
  );

  return c.json({ ok: true });
}

async function processEvent(body: SlackEvent) {
  const event = body.event;
  if (!event) return;

  if (event.type === "app_uninstalled" || event.type === "tokens_revoked") {
    const teamId = body.team_id;
    if (teamId) {
      await db
        .delete(integration)
        .where(
          and(
            eq(integration.name, "slack-agent"),
            eq(integration.externalId, teamId),
          ),
        );
      await db
        .update(pageSubscriber)
        .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(pageSubscriber.channelType, "slack"),
            isNull(pageSubscriber.unsubscribedAt),
            sql`json_extract(${pageSubscriber.channelConfig}, '$.teamId') = ${teamId}`,
          ),
        );
      logger.info("slack integration cleaned up", { teamId });
    }
    return;
  }

  if (event.type === "app_home_opened") {
    if (event.tab && event.tab !== "home") return;
    const teamId = body.team_id;
    const userId = event.user;
    if (!teamId || !userId) return;
    const resolved = await resolveWorkspace(teamId);
    if (!resolved) return;
    try {
      await publishHomeView(new WebClient(resolved.botToken), userId);
    } catch (err) {
      logger.error("slack failed to publish home view", { error: err, teamId });
    }
    return;
  }

  if (event.type === "assistant_thread_started") {
    const teamId = body.team_id;
    const thread = event.assistant_thread;
    if (!teamId || !thread) return;
    const resolved = await resolveWorkspace(teamId);
    if (!resolved) return;
    try {
      await startAssistantThread(
        new WebClient(resolved.botToken),
        thread.channel_id,
        thread.thread_ts,
      );
    } catch (err) {
      logger.error("slack failed to start assistant thread", {
        error: err,
        teamId,
      });
    }
    return;
  }

  if (event.type !== "app_mention" && event.type !== "message") return;
  if (event.type === "message" && event.bot_id) return;

  // The agent pane is the app's DM: every message there is addressed to us,
  // so no mention is required.
  const isAgentThread = event.channel_type === "im";

  const ignoredSubtypes = [
    "channel_join",
    "channel_leave",
    "channel_topic",
    "channel_purpose",
    "channel_name",
  ];
  if (event.subtype && ignoredSubtypes.includes(event.subtype)) return;
  // In the agent pane, subtypes are the thread root (`assistant_app_thread`),
  // edits and deletions — only plain user messages start a turn.
  if (isAgentThread && event.subtype) return;

  const teamId = body.team_id;
  if (!teamId || !event.channel || !event.ts) return;

  // A single mention arrives as BOTH an `app_mention` and a `message.*` event
  // (distinct event_ids, same message ts), so the event_id dedup above doesn't
  // catch the pair. Dedup on the message identity so we only respond once.
  // Runs before the first `await` so concurrent deliveries can't both pass.
  if (dedup(`msg:${event.channel}:${event.ts}`)) return;

  const resolved = await resolveWorkspace(teamId);
  if (!resolved) {
    logger.warn("slack integration not found", { teamId });
    return;
  }

  const slack = new WebClient(resolved.botToken);
  const botUserId = resolved.botUserId;
  const threadTs = event.thread_ts ?? event.ts;

  // Fetched early only when needed to decide whether to answer; reused below
  // so the agent sees the same thread.
  let prefetchedThread: ThreadMessage[] | undefined;
  if (
    !isAgentThread &&
    event.type === "message" &&
    !event.text?.includes(`<@${botUserId}>`)
  ) {
    if (!event.thread_ts) return;
    try {
      prefetchedThread = await fetchThread(
        slack,
        event.channel,
        event.thread_ts,
      );
    } catch (err) {
      logger.warn("slack failed to fetch thread for untagged reply", {
        error: err,
        channel: event.channel,
        teamId,
      });
      return;
    }
    if (
      !isAnswerToAgent(
        prefetchedThread,
        { ts: event.ts, user: event.user },
        botUserId,
      )
    ) {
      return;
    }
  }

  logger.info("slack event received", {
    teamId,
    channel: event.channel,
    eventType: event.type,
    threadTs,
    user: event.user,
    agentThread: isAgentThread,
  });

  const reply =
    (await acknowledgeWithSession(
      slack,
      event.channel,
      threadTs,
      teamId,
      event.user,
    )) ??
    (isAgentThread
      ? await acknowledgeInAgentThread(slack, event.channel, threadTs, teamId)
      : await acknowledgeInChannel(slack, event.channel, threadTs, teamId));
  if (!reply) return;

  try {
    let thread: ThreadMessage[] = [];
    if (prefetchedThread) {
      thread = prefetchedThread;
    } else if (event.thread_ts) {
      thread = (
        await fetchThread(slack, event.channel, event.thread_ts)
      ).filter((msg) => msg.ts !== reply.placeholderTs);
    } else {
      thread = [{ user: event.user, text: event.text, ts: event.ts }];
    }

    logger.info("slack agent invoked", {
      teamId,
      channel: event.channel,
      threadTs,
      messageCount: thread.length,
    });

    const result = await runAgent(
      resolved.workspace,
      thread,
      botUserId,
      event.text,
      { slackUserId: event.user ?? "", teamId },
    );

    logger.info("slack agent completed", {
      teamId,
      channel: event.channel,
      threadTs,
      toolCalls: result.toolResults.map((tr) => tr.toolName),
      finishReason: result.finishReason,
      stepCount: result.stepCount,
      hitStepLimit: result.hitStepLimit,
    });

    // One pending action per thread (see findByThread/replace below).
    // If the model emits multiple destructive drafts in a single step we
    // only honour the first; the carrier's thread index can't represent
    // a queue, and forcing the user to confirm twice in a row is worse
    // UX than asking them to re-issue the second request.
    const confirmationResult = result.toolResults.find((tr) =>
      isSlackToolDraft(tr.result),
    );

    if (confirmationResult) {
      logger.info("slack confirmation requested", {
        teamId,
        channel: event.channel,
        threadTs,
        toolName: confirmationResult.toolName,
      });
      await handleConfirmation(
        slack,
        reply,
        event.channel,
        threadTs,
        event.user ?? "",
        resolved.workspace.id,
        resolved.botToken,
        confirmationResult,
      );
    } else {
      // No draft means no card. Distinguish a legitimate text answer from the
      // model drafting a change in prose and asking for permission instead of
      // calling the tool — the latter strands the user with nothing to click.
      if (looksLikeUncardedDraft(result.text)) {
        logger.warn("slack draft proposed without a card", {
          teamId,
          channel: event.channel,
          threadTs,
          finishReason: result.finishReason,
          stepCount: result.stepCount,
          hitStepLimit: result.hitStepLimit,
          readToolCalls: result.toolResults.map((tr) => tr.toolName),
        });
      }
      await reply.send({
        text: result.text ? toMrkdwn(result.text) : "Done!",
      });
      logger.info("slack response sent", {
        teamId,
        channel: event.channel,
        threadTs,
      });
    }
  } catch (err) {
    logger.error("slack agent error", {
      error: err,
      channel: event.channel,
      teamId,
      threadTs,
    });
    await reply
      .send({ text: ":x: Something went wrong. Please try again." })
      .catch((sendErr: unknown) => {
        logger.error("slack failed to send error message", {
          error: sendErr,
          channel: event.channel,
          threadTs,
        });
      });
  } finally {
    await reply.finish?.();
  }
}

/**
 * Where the agent's answer goes. In a channel we post a "Thinking..." message
 * up front and overwrite it; in the agent pane Slack renders a native status
 * instead, so the answer is a fresh message in the thread.
 */
interface Reply {
  /** Writes the answer and returns the ts of the message holding it. */
  send(message: { text: string; blocks?: Block[] }): Promise<string>;
  /** Our own "Thinking..." message, to keep it out of the agent's context. */
  placeholderTs?: string;
  /** Runs once the turn is over, whether it succeeded or not. */
  finish?: () => Promise<void>;
}

function postInThread(
  slack: WebClient,
  channel: string,
  threadTs: string,
): Reply["send"] {
  return async ({ text, blocks }) => {
    const res = await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text,
      blocks,
    });
    if (!res.ts) throw new Error("chat.postMessage returned no ts");
    return res.ts;
  };
}

/**
 * Preferred acknowledgement: mark the thread's agent session as `processing`
 * so Slack shows the agent working — no placeholder message — and hand it
 * back as `active` once we've answered. Returns undefined when the workspace
 * doesn't support agent sessions, so the caller falls back to the older
 * indicators.
 */
async function acknowledgeWithSession(
  slack: WebClient,
  channel: string,
  threadTs: string,
  teamId: string,
  userId: string | undefined,
): Promise<Reply | undefined> {
  try {
    await setSessionStatus(slack, channel, threadTs, "processing", userId);
  } catch (err) {
    logger.info("slack agent session unavailable, falling back", {
      error: err,
      channel,
      teamId,
    });
    return;
  }
  return {
    send: postInThread(slack, channel, threadTs),
    async finish() {
      await setSessionStatus(slack, channel, threadTs, "active").catch(
        (err: unknown) =>
          logger.warn("slack failed to reset agent session status", {
            error: err,
            channel,
            teamId,
          }),
      );
    },
  };
}

async function acknowledgeInAgentThread(
  slack: WebClient,
  channel: string,
  threadTs: string,
  teamId: string,
): Promise<Reply> {
  // Best-effort: a missing status only loses the loading indicator.
  await setAssistantStatus(slack, channel, threadTs, "is thinking...").catch(
    (err: unknown) =>
      logger.warn("slack failed to set assistant status", {
        error: err,
        channel,
        teamId,
      }),
  );
  return { send: postInThread(slack, channel, threadTs) };
}

async function acknowledgeInChannel(
  slack: WebClient,
  channel: string,
  threadTs: string,
  teamId: string,
): Promise<Reply | undefined> {
  let thinkingTs: string | undefined;
  try {
    const thinkingMsg = await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: ":hourglass_flowing_sand: Thinking...",
    });
    thinkingTs = thinkingMsg.ts;
  } catch (err) {
    if (isSlackPlatformError(err, "cannot_reply_to_message")) {
      logger.warn("slack cannot reply to message, falling back to top-level", {
        channel,
        teamId,
        threadTs,
      });
      try {
        const fallbackMsg = await slack.chat.postMessage({
          channel,
          text: ":hourglass_flowing_sand: Thinking...",
        });
        thinkingTs = fallbackMsg.ts;
      } catch (fallbackErr) {
        logger.error("slack failed to post fallback thinking message", {
          error: fallbackErr,
          channel,
          teamId,
        });
        return;
      }
    } else {
      logger.error("slack failed to post thinking message", {
        error: err,
        channel,
        teamId,
        threadTs,
      });
      return;
    }
  }

  if (!thinkingTs) {
    logger.error("slack thinking message returned no ts", { channel, teamId });
    return;
  }

  const ts = thinkingTs;
  return {
    placeholderTs: ts,
    async send({ text, blocks }) {
      await slack.chat.update({ channel, ts, text, blocks });
      return ts;
    },
  };
}

async function handleConfirmation(
  slack: WebClient,
  reply: Reply,
  channel: string,
  threadTs: string,
  userId: string,
  workspaceId: number,
  botToken: string,
  confirmationResult: { toolName: string; result: unknown },
) {
  if (!isSlackToolDraft(confirmationResult.result)) return;
  const draft = confirmationResult.result;
  const tool = getRegistryTool(draft.toolName);
  if (!tool) {
    logger.error("slack: registry tool not found", {
      toolName: draft.toolName,
    });
    await reply.send({ text: ":x: Something went wrong. Please try again." });
    return;
  }

  const payload: PendingPayload = {
    toolName: draft.toolName,
    input: draft.input,
  };
  const text = getConfirmationText({ tool, input: draft.displayInput });

  // findByThread + replace isn't atomic on its own — two concurrent
  // events on the same thread could both see `existing` and race on
  // replace. Atomicity here relies on the `dedup` map at the top of this
  // file suppressing duplicate event_ids, plus Slack's own per-thread
  // event throttling. Cross-process dedup is *not* covered; see note in
  // processedEvents.
  const existing = await findByThread(threadTs);
  if (existing) {
    await replace(existing.id, payload);

    const blocks = await buildConfirmationBlocks({
      actionId: existing.id,
      tool,
      input: draft.displayInput,
      resolvers: makeRefResolvers(workspaceId),
    });
    await reply.send({ text, blocks });
    await slack.chat.update({
      channel,
      ts: existing.messageTs,
      text,
      blocks,
    });
  } else {
    // The card's buttons carry the action id, and the stored action carries
    // the card's ts — so write the text first to learn the ts, then attach
    // the buttons.
    const messageTs = await reply.send({ text });
    const actionId = await store({
      workspaceId,
      botToken,
      channelId: channel,
      threadTs,
      messageTs,
      userId,
      payload,
    });

    const blocks = await buildConfirmationBlocks({
      actionId,
      tool,
      input: draft.displayInput,
      resolvers: makeRefResolvers(workspaceId),
    });
    await slack.chat.update({ channel, ts: messageTs, text, blocks });
  }
}
