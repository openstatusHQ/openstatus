import { getLogger } from "@logtape/logtape";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { integration, pageSubscriber } from "@openstatus/db/src/schema";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { z } from "zod";

import { runAgent } from "./agent";
import {
  type Block,
  buildConfirmationBlocks,
  getConfirmationText,
  type RefResolvers,
} from "./blocks";
import {
  findByThread,
  newActionId,
  replace,
  store,
} from "./confirmation-store";
import type { PendingPayload } from "./confirmation-store";
import { publishHomeView } from "./home";
import { getComponentNames, getPageDashboardLink } from "./page-urls";
import { getRegistryTool, isSlackToolDraft } from "./registry-runner";
import { startThinkingStatus } from "./status";
import { resolveWorkspace } from "./workspace-resolver";

function makeRefResolvers(workspaceId: number): RefResolvers {
  return {
    page: (pageId) => getPageDashboardLink(workspaceId, pageId),
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

/**
 * Posts into the thread, falling back to a top-level message when Slack
 * refuses the reply. Returns the new message ts, or undefined if both
 * attempts failed.
 */
async function postThreadReply(
  slack: WebClient,
  channel: string,
  threadTs: string,
  message: { text: string; blocks?: Block[] },
): Promise<string | undefined> {
  try {
    const posted = await slack.chat.postMessage({
      channel,
      thread_ts: threadTs,
      ...message,
    });
    return posted.ts;
  } catch (err) {
    if (!isSlackPlatformError(err, "cannot_reply_to_message")) {
      logger.error("slack failed to post reply", { error: err, channel });
      return undefined;
    }
    logger.warn("slack cannot reply to message, falling back to top-level", {
      channel,
      threadTs,
    });
    try {
      const fallback = await slack.chat.postMessage({ channel, ...message });
      return fallback.ts;
    } catch (fallbackErr) {
      logger.error("slack failed to post fallback reply", {
        error: fallbackErr,
        channel,
      });
      return undefined;
    }
  }
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

  if (event.type !== "app_mention" && event.type !== "message") return;
  if (event.type === "message" && event.bot_id) return;

  const ignoredSubtypes = [
    "channel_join",
    "channel_leave",
    "channel_topic",
    "channel_purpose",
    "channel_name",
  ];
  if (event.subtype && ignoredSubtypes.includes(event.subtype)) return;

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

  if (event.type === "message" && !event.text?.includes(`<@${botUserId}>`)) {
    return;
  }

  logger.info("slack event received", {
    teamId,
    channel: event.channel,
    eventType: event.type,
    threadTs,
    user: event.user,
  });

  const status = await startThinkingStatus(slack, event.channel, threadTs);

  try {
    let thread: ThreadMessage[] = [];
    if (event.thread_ts) {
      const replies = await slack.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 100,
      });
      thread = (replies.messages ?? []) as ThreadMessage[];
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
    });

    // One pending action per thread (see findByThread/replace below).
    // If the model emits multiple destructive drafts in a single step we
    // only honour the first; the carrier's thread index can't represent
    // a queue, and forcing the user to confirm twice in a row is worse
    // UX than asking them to re-issue the second request.
    const confirmationResult = result.toolResults.find((tr) =>
      isSlackToolDraft(tr.result),
    );

    // Clear the indicator before posting so a refresh tick can't resurrect it.
    await status.stop();

    if (confirmationResult) {
      logger.info("slack confirmation requested", {
        teamId,
        channel: event.channel,
        threadTs,
        toolName: confirmationResult.toolName,
      });
      await handleConfirmation(
        slack,
        event.channel,
        threadTs,
        event.user ?? "",
        resolved.workspace.id,
        resolved.botToken,
        confirmationResult,
      );
    } else {
      const posted = await postThreadReply(slack, event.channel, threadTs, {
        text: result.text || "Done!",
      });
      if (!posted) {
        // postThreadReply already exhausted the top-level fallback, so the
        // answer is lost; don't claim it was delivered.
        logger.error("slack response not delivered", {
          teamId,
          channel: event.channel,
          threadTs,
        });
        return;
      }
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
    await status.stop();
    await postThreadReply(slack, event.channel, threadTs, {
      text: ":x: Something went wrong. Please try again.",
    });
  }
}

async function handleConfirmation(
  slack: WebClient,
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
    await postThreadReply(slack, channel, threadTs, {
      text: ":x: Something went wrong. Please try again.",
    });
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
  const actionId = existing?.id ?? newActionId();

  const blocks = await buildConfirmationBlocks({
    actionId,
    tool,
    input: draft.displayInput,
    resolvers: makeRefResolvers(workspaceId),
  });

  // Strip the old card's buttons first: both cards carry the same actionId,
  // so leaving it live would let one click consume the other's action.
  if (existing) {
    await slack.chat.update({
      channel,
      ts: existing.messageTs,
      text: ":no_entry_sign: Superseded by a newer request.",
      blocks: [],
    });
  }

  const messageTs = await postThreadReply(slack, channel, threadTs, {
    text,
    blocks,
  });
  if (!messageTs) {
    // Without a card there is nothing to approve, so leave the pending record
    // alone and let its TTL expire rather than pointing it at a dead message.
    logger.error("slack confirmation card not delivered", {
      channel,
      threadTs,
      toolName: draft.toolName,
    });
    return;
  }

  if (existing) {
    await replace(existing.id, payload, messageTs);
  } else {
    await store({
      id: actionId,
      workspaceId,
      botToken,
      channelId: channel,
      threadTs,
      messageTs,
      userId,
      payload,
    });
  }
}
