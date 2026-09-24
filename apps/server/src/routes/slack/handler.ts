import { getLogger } from "@logtape/logtape";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { integration, pageSubscriber } from "@openstatus/db/src/schema";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { z } from "zod";

import { type AgentEvents, runAgent } from "./agent";
import { greetOnce, setAssistantStatus, setSessionStatus } from "./assistant";
import {
  type Block,
  buildAnswerMessage,
  buildConfirmationBlocks,
  getConfirmationText,
  type RefResolvers,
} from "./blocks";
import {
  channelContextTooling,
  contextChannelId,
  contextUserId,
  forgetContext,
  recallContext,
  rememberContext,
} from "./channel-context";
import { findByThread, replace, store } from "./confirmation-store";
import type { PendingPayload } from "./confirmation-store";
import { publishHomeView } from "./home";
import {
  getComponentNames,
  getPageDashboardLink,
  getStatusReportLink,
} from "./page-urls";
import { getRegistryTool, isSlackToolDraft } from "./registry-runner";
import { abortTurn, endTurn, startTurn } from "./running-turns";
import {
  buildThreadTitle,
  isThreadTitled,
  markThreadTitled,
  renameThread,
} from "./thread-title";
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
          user_id: z.string().optional(),
        })
        .optional(),
      // `app_context_changed` — what the user has on screen. Absent entities
      // (`"context": {}`) mean they moved somewhere with nothing to track.
      context: z
        .object({
          entities: z
            .array(
              z.object({
                type: z.string().optional(),
                value: z.string().optional(),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  event_id: z.string().optional(),
  team_id: z.string().optional(),
  challenge: z.string().optional(),
  // `app_context_changed` carries no `event.user`; the human is in here.
  authorizations: z
    .array(
      z.object({
        user_id: z.string().optional(),
        is_bot: z.boolean().optional(),
      }),
    )
    .optional(),
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

  // Both tabs of the app's DM arrive here. The agent experience has no
  // "thread started" event, so opening the Messages tab is where a first-time
  // user gets greeted; `greetOnce` makes the repeat opens harmless.
  if (event.type === "app_home_opened") {
    const tab = event.tab ?? "home";
    if (tab !== "home" && tab !== "messages") return;
    const teamId = body.team_id;
    const userId = event.user;
    if (!teamId || !userId) return;
    const resolved = await resolveWorkspace(teamId);
    if (!resolved) return;
    const slack = new WebClient(resolved.botToken);

    if (tab === "messages") {
      if (!event.channel) return;
      try {
        await greetOnce({
          slack,
          teamId,
          userId,
          channel: event.channel,
        });
      } catch (err) {
        logger.error("slack failed to greet user", { error: err, teamId });
      }
      return;
    }

    try {
      await publishHomeView(slack, userId);
    } catch (err) {
      logger.error("slack failed to publish home view", { error: err, teamId });
    }
    return;
  }

  // Only fires while the app is still on `assistant_view`. Delete this branch
  // once the `agent_view` manifest is live — the agent experience greets from
  // `app_home_opened` above instead.
  if (event.type === "assistant_thread_started") {
    const teamId = body.team_id;
    const thread = event.assistant_thread;
    if (!teamId || !thread?.user_id) return;
    const resolved = await resolveWorkspace(teamId);
    if (!resolved) return;
    try {
      await greetOnce({
        slack: new WebClient(resolved.botToken),
        teamId,
        userId: thread.user_id,
        channel: thread.channel_id,
        threadTs: thread.thread_ts,
      });
    } catch (err) {
      logger.error("slack failed to greet in new thread", {
        error: err,
        teamId,
      });
    }
    return;
  }

  // What the user is looking at, remembered for the next turn. Nothing is
  // read here — this only records where they are.
  if (event.type === "app_context_changed") {
    const teamId = body.team_id;
    const userId = contextUserId(body.authorizations);
    if (!teamId || !userId) return;

    const channelId = contextChannelId(event.context?.entities);
    if (channelId) {
      await rememberContext(teamId, userId, channelId);
    } else {
      await forgetContext(teamId, userId);
    }
    return;
  }

  // A person renamed the thread, so the name is theirs now — record it so no
  // later turn overwrites it.
  if (event.type === "agent_session_title_changed") {
    if (!event.channel || !event.thread_ts) return;
    await markThreadTitled(event.channel, event.thread_ts);
    logger.info("slack thread renamed by user", {
      teamId: body.team_id,
      channel: event.channel,
      threadTs: event.thread_ts,
    });
    return;
  }

  // The user pressed stop. Slack has already halted any streamed message and
  // will not clear the session status itself, so both are on us.
  if (event.type === "agent_session_stopped") {
    const teamId = body.team_id;
    const channel = event.channel;
    const threadTs = event.thread_ts;
    if (!teamId || !channel || !threadTs) return;

    const wasRunning = abortTurn(channel, threadTs);
    logger.info("slack turn stopped by user", {
      teamId,
      channel,
      threadTs,
      wasRunning,
    });

    // Cleared here as well as in the aborted turn's own cleanup: the turn may
    // be running on another instance, or already be gone.
    const resolved = await resolveWorkspace(teamId);
    if (!resolved) return;
    await setSessionStatus(
      new WebClient(resolved.botToken),
      channel,
      threadTs,
      "active",
    ).catch((err: unknown) =>
      logger.warn("slack failed to clear status after stop", {
        error: err,
        channel,
        teamId,
      }),
    );
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

  const reply = await createReply({
    slack,
    channel: event.channel,
    threadTs,
    teamId,
    userId: event.user,
    isAgentThread,
  });
  if (!reply) return;

  const turn = startTurn(event.channel, threadTs);

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

    // Only in the pane: in a channel the agent is already reading the thread
    // it was mentioned in, and "what you're looking at" is that same channel.
    const contextChannel =
      isAgentThread && event.user
        ? await recallContext(teamId, event.user)
        : undefined;
    const context = contextChannel
      ? channelContextTooling({ slack, channelId: contextChannel })
      : undefined;

    logger.info("slack agent invoked", {
      teamId,
      channel: event.channel,
      threadTs,
      messageCount: thread.length,
      contextChannel,
    });

    const result = await runAgent(
      resolved.workspace,
      thread,
      botUserId,
      event.text,
      { slackUserId: event.user ?? "", teamId },
      {
        events: reply.progress,
        signal: turn.signal,
        tools: context?.tools,
        contextNote: context?.contextNote,
      },
    );

    if (result.aborted) {
      logger.info("slack turn abandoned after stop", {
        teamId,
        channel: event.channel,
        threadTs,
      });
      await reply.stopped();
      return;
    }

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
        teamId,
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
      if (result.text) {
        await reply.answer(result.text);
      } else {
        await reply.send({ text: "Done!" });
      }
      logger.info("slack response sent", {
        teamId,
        channel: event.channel,
        threadTs,
      });
    }

    await titleThread({
      slack,
      channel: event.channel,
      threadTs,
      teamId,
      workspaceId: resolved.workspace.id,
      isAgentThread,
      draft:
        confirmationResult && isSlackToolDraft(confirmationResult.result)
          ? confirmationResult.result
          : undefined,
      userText: event.text,
    });
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
    endTurn(event.channel, threadTs, turn);
    await reply.finish?.();
  }
}

function statusReportIdOf(input: unknown): number | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const id = (input as { statusReportId?: unknown }).statusReportId;
  return typeof id === "number" ? id : undefined;
}

/**
 * Names the thread after its subject, so the agent pane's timeline reads as a
 * list of incidents rather than a list of operations.
 *
 * Confined to the agent pane: that timeline is the whole payoff, and Slack
 * documents `agents.sessions.rename` as also renaming the channel for session
 * channels — not something to risk on a shared incident channel.
 *
 * Cosmetic, and last: a failure here must never cost the user their answer.
 */
async function titleThread(args: {
  slack: WebClient;
  channel: string;
  threadTs: string;
  teamId: string;
  workspaceId: number;
  isAgentThread: boolean;
  draft?: { toolName: string; input: unknown };
  userText?: string;
}): Promise<void> {
  const {
    slack,
    channel,
    threadTs,
    teamId,
    workspaceId,
    isAgentThread,
    draft,
    userText,
  } = args;
  if (!isAgentThread) return;

  try {
    if (await isThreadTitled(channel, threadTs)) return;

    // Only looked up once, and only for a draft that acts on an existing
    // report — `add_update` and `resolve` carry an id but no title.
    let reportTitle: string | undefined;
    const reportId = draft && statusReportIdOf(draft.input);
    if (reportId !== undefined) {
      const link = await getStatusReportLink(workspaceId, reportId);
      reportTitle = link?.title;
    }

    const title = buildThreadTitle({ draft, reportTitle, userText });
    if (!title) return;

    await renameThread({ slack, channel, threadTs, title, teamId });
  } catch (err) {
    logger.warn("slack failed to title the thread", {
      error: err,
      channel,
      teamId,
    });
  }
}

/**
 * Where the agent's output goes, in descending order of how much the user gets
 * to see while they wait: a streamed message that fills in as the model writes,
 * with a task entry per tool call; a native "working" status on the thread; or
 * a "Thinking..." message we post up front and overwrite.
 */
interface Reply {
  /**
   * Delivers the agent's free-text answer and returns the ts of the message
   * holding it. When the answer was streamed it is already on screen, and this
   * only finalizes the message.
   */
  answer(text: string): Promise<string>;
  /** Writes a message of our own — a confirmation card, or an error. */
  send(message: { text: string; blocks?: Block[] }): Promise<string>;
  /**
   * Confirms the turn ended because the user stopped it, leaving whatever was
   * already written in place.
   */
  stopped(): Promise<void>;
  /** Progress to report while the turn runs, when the surface can show it. */
  progress?: AgentEvents;
  /** Our own "Thinking..." message, to keep it out of the agent's context. */
  placeholderTs?: string;
  /** Runs once the turn is over, whether it succeeded or not. */
  finish?: () => Promise<void>;
}

const STOPPED_NOTICE = "_Stopped._";

/**
 * Registry tools are named `verb_noun` (`list_status_pages`,
 * `get_monitor_status`). A task list reads better as an activity, so the verb
 * becomes a gerund and the rest is left as words.
 */
const TOOL_ACTIVITY: Record<string, string> = {
  list: "Reading",
  get: "Reading",
  search: "Searching",
  create: "Drafting",
  add: "Drafting",
  update: "Drafting",
  resolve: "Drafting",
};

export function toolTaskTitle(toolName: string): string {
  const [verb, ...rest] = toolName.split("_");
  const subject = rest.join(" ");
  const activity = TOOL_ACTIVITY[verb];
  if (!activity || !subject) return toolName.replace(/_/g, " ");
  return `${activity} ${subject}`;
}

function taskChunk(
  id: string,
  toolName: string,
  status: "in_progress" | "complete",
) {
  return {
    type: "task_update" as const,
    id,
    title: toolTaskTitle(toolName),
    status,
  };
}

/**
 * Opens a stream for the turn, or returns undefined when this surface can't
 * carry one. Whether the *workspace* allows streaming only shows up on the
 * first append, mid-turn — `streamingReply` handles that failure.
 */
function createStreamer(args: {
  slack: WebClient;
  channel: string;
  threadTs: string;
  teamId: string;
  userId: string | undefined;
  isAgentThread: boolean;
}) {
  const { slack, channel, threadTs, teamId, userId, isAgentThread } = args;
  // Older @slack/web-api has no streaming support.
  if (typeof slack.chatStream !== "function") return undefined;
  // Outside a DM, Slack needs to know who the streamed message is for.
  if (!isAgentThread && !userId) return undefined;
  try {
    return slack.chatStream({
      channel,
      thread_ts: threadTs,
      task_display_mode: "timeline",
      recipient_user_id: userId,
      recipient_team_id: teamId,
    });
  } catch (err) {
    logger.warn("slack could not open a stream", {
      error: err,
      channel,
      teamId,
    });
    return undefined;
  }
}

/**
 * Streams the answer as the model writes it. Every stream call is best-effort:
 * a workspace without streaming enabled only fails on the first append, by
 * which point the turn is already running, so a failure latches into `broken`
 * and the answer is posted (or the half-written message rewritten) instead.
 */
function streamingReply(args: {
  slack: WebClient;
  streamer: NonNullable<ReturnType<typeof createStreamer>>;
  channel: string;
  threadTs: string;
  teamId: string;
  finishSession?: () => Promise<void>;
}): Reply {
  const { slack, streamer, channel, threadTs, teamId, finishSession } = args;
  const post = postInThread(slack, channel, threadTs);

  let appended = false;
  let streamedText = false;
  let broken = false;
  let streamClosed = false;

  const attempt = async (fn: () => Promise<void>) => {
    if (broken) return;
    try {
      await fn();
      appended = true;
    } catch (err) {
      broken = true;
      logger.warn("slack stream failed, falling back to a posted message", {
        error: err,
        channel,
        teamId,
      });
    }
  };

  /** Finalizes the streamed message, if one was ever opened. */
  const closeStream = async (): Promise<string | undefined> => {
    if (streamClosed || broken || !appended) return streamer.ts;
    streamClosed = true;
    try {
      await streamer.stop();
    } catch (err) {
      broken = true;
      logger.warn("slack failed to stop the stream", {
        error: err,
        channel,
        teamId,
      });
    }
    return streamer.ts;
  };

  return {
    progress: {
      onTextDelta: (delta) =>
        attempt(async () => {
          await streamer.append({ markdown_text: delta });
          streamedText = true;
        }),
      onToolCall: ({ id, toolName }) =>
        attempt(async () => {
          await streamer.append({
            chunks: [taskChunk(id, toolName, "in_progress")],
          });
        }),
      onToolResult: ({ id, toolName }) =>
        attempt(async () => {
          await streamer.append({
            chunks: [taskChunk(id, toolName, "complete")],
          });
        }),
    },
    async answer(text) {
      const ts = await closeStream();
      if (streamedText && !broken) return ts ?? "";
      // The stream never carried the answer — nothing was streamed, or it
      // broke partway. Put the whole answer on screen, rewriting the
      // half-written message when there is one.
      const message = buildAnswerMessage(text);
      if (ts) {
        await slack.chat.update({ channel, ts, ...message });
        return ts;
      }
      return post(message);
    },
    async send(message) {
      // The card is a message of its own: updating the streamed one in place
      // would wipe the answer Slack has already rendered.
      await closeStream();
      return post(message);
    },
    async stopped() {
      if (streamClosed || broken || !appended) {
        await post({ text: STOPPED_NOTICE });
        return;
      }
      streamClosed = true;
      try {
        // Closes the partial answer with the notice attached. Slack halts the
        // stream on its side when the user presses stop, so this often fails —
        // the partial message is already final, which is the point.
        await streamer.stop({ markdown_text: `\n\n${STOPPED_NOTICE}` });
      } catch (err) {
        logger.info("slack stream already closed by the stop request", {
          error: err,
          channel,
          teamId,
        });
      }
    },
    async finish() {
      await closeStream();
      await finishSession?.();
    },
  };
}

/**
 * Picks the richest delivery this surface supports. The session status is
 * independent of streaming — a streamed turn still marks the thread as
 * working, so Slack shows the loading state and the stop button.
 */
async function createReply(args: {
  slack: WebClient;
  channel: string;
  threadTs: string;
  teamId: string;
  userId: string | undefined;
  isAgentThread: boolean;
}): Promise<Reply | undefined> {
  const { slack, channel, threadTs, teamId, userId, isAgentThread } = args;

  const session = await acknowledgeWithSession(
    slack,
    channel,
    threadTs,
    teamId,
    userId,
  );

  // The status is the loading indicator, not the delivery: a streamed turn in
  // the agent pane still needs it when agent sessions aren't available.
  if (!session && isAgentThread) {
    // Best-effort: a missing status only loses the loading indicator.
    await setAssistantStatus(slack, channel, threadTs, "is thinking...").catch(
      (err: unknown) =>
        logger.warn("slack failed to set assistant status", {
          error: err,
          channel,
          teamId,
        }),
    );
  }

  const streamer = createStreamer(args);
  if (streamer) {
    return streamingReply({
      slack,
      streamer,
      channel,
      threadTs,
      teamId,
      finishSession: session?.finish,
    });
  }

  if (session) return session;
  if (isAgentThread) return acknowledgeInAgentThread(slack, channel, threadTs);
  return acknowledgeInChannel(slack, channel, threadTs, teamId);
}

function postInThread(
  slack: WebClient,
  channel: string,
  threadTs: string,
): Reply["send"] {
  return async ({ text, blocks }) => {
    try {
      const res = await slack.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text,
        blocks,
      });
      if (!res.ts) throw new Error("chat.postMessage returned no ts");
      return res.ts;
    } catch (err) {
      if (!isSlackPlatformError(err, "cannot_reply_to_message")) throw err;
      // The parent message can't host a thread — answer at the top level
      // rather than losing the reply entirely.
      logger.warn("slack cannot reply to message, falling back to top-level", {
        channel,
        threadTs,
      });
      const res = await slack.chat.postMessage({ channel, text, blocks });
      if (!res.ts) throw new Error("chat.postMessage returned no ts");
      return res.ts;
    }
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
  const send = postInThread(slack, channel, threadTs);
  return {
    send,
    answer: (text) => send(buildAnswerMessage(text)),
    stopped: async () => {
      await send({ text: STOPPED_NOTICE });
    },
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

// The status was already set by `createReply`; Slack clears it as soon as the
// app posts in the thread, so there is no matching "clear" call.
function acknowledgeInAgentThread(
  slack: WebClient,
  channel: string,
  threadTs: string,
): Reply {
  const send = postInThread(slack, channel, threadTs);
  return {
    send,
    answer: (text) => send(buildAnswerMessage(text)),
    stopped: async () => {
      await send({ text: STOPPED_NOTICE });
    },
  };
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
  const send: Reply["send"] = async ({ text, blocks }) => {
    await slack.chat.update({ channel, ts, text, blocks });
    return ts;
  };
  return {
    placeholderTs: ts,
    send,
    answer: (text) => send(buildAnswerMessage(text)),
    // Overwrites "Thinking...", which would otherwise stand forever.
    stopped: async () => {
      await send({ text: STOPPED_NOTICE });
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
  teamId: string,
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
      teamId,
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
