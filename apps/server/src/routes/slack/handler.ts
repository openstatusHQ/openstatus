import { getLogger } from "@logtape/logtape";
import { and, db, eq, isNull, sql } from "@openstatus/db";
import { integration, pageSubscriber } from "@openstatus/db/src/schema";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { z } from "zod";

import { runAgent } from "./agent";
import {
  buildConfirmationBlocks,
  getConfirmationText,
  type RefResolvers,
} from "./blocks";
import { findByThread, replace, store } from "./confirmation-store";
import type { PendingPayload } from "./confirmation-store";
import { publishHomeView } from "./home";
import { getComponentNames, getPageDashboardLink } from "./page-urls";
import { getRegistryTool, isSlackToolDraft } from "./registry-runner";
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

  let thinkingTs: string | undefined;
  try {
    const thinkingMsg = await slack.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: ":hourglass_flowing_sand: Thinking...",
    });
    thinkingTs = thinkingMsg.ts;
  } catch (err) {
    if (isSlackPlatformError(err, "cannot_reply_to_message")) {
      logger.warn("slack cannot reply to message, falling back to top-level", {
        channel: event.channel,
        teamId,
        threadTs,
      });
      try {
        const fallbackMsg = await slack.chat.postMessage({
          channel: event.channel,
          text: ":hourglass_flowing_sand: Thinking...",
        });
        thinkingTs = fallbackMsg.ts;
      } catch (fallbackErr) {
        logger.error("slack failed to post fallback thinking message", {
          error: fallbackErr,
          channel: event.channel,
          teamId,
        });
        return;
      }
    } else {
      logger.error("slack failed to post thinking message", {
        error: err,
        channel: event.channel,
        teamId,
        threadTs,
      });
      return;
    }
  }

  if (!thinkingTs) {
    logger.error("slack thinking message returned no ts", {
      channel: event.channel,
      teamId,
    });
    return;
  }

  try {
    let thread: ThreadMessage[] = [];
    if (event.thread_ts) {
      const replies = await slack.conversations.replies({
        channel: event.channel,
        ts: event.thread_ts,
        limit: 100,
      });
      thread = ((replies.messages ?? []) as ThreadMessage[]).filter(
        (msg) => msg.ts !== thinkingTs,
      );
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
        thinkingTs,
        event.user ?? "",
        resolved.workspace.id,
        resolved.botToken,
        confirmationResult,
      );
    } else {
      await slack.chat.update({
        channel: event.channel,
        ts: thinkingTs,
        text: result.text || "Done!",
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
    if (thinkingTs) {
      await slack.chat
        .update({
          channel: event.channel,
          ts: thinkingTs,
          text: ":x: Something went wrong. Please try again.",
        })
        .catch((updateErr: unknown) => {
          logger.error("slack failed to update error message", {
            error: updateErr,
            channel: event.channel,
            thinkingTs,
          });
        });
    }
  }
}

async function handleConfirmation(
  slack: WebClient,
  channel: string,
  threadTs: string,
  thinkingTs: string,
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
    await slack.chat.update({
      channel,
      ts: thinkingTs,
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
  if (existing) {
    await replace(existing.id, payload);

    const blocks = await buildConfirmationBlocks({
      actionId: existing.id,
      tool,
      input: draft.displayInput,
      resolvers: makeRefResolvers(workspaceId),
    });
    await slack.chat.update({ channel, ts: thinkingTs, text, blocks });
    await slack.chat.update({
      channel,
      ts: existing.messageTs,
      text,
      blocks,
    });
  } else {
    const actionId = await store({
      workspaceId,
      botToken,
      channelId: channel,
      threadTs,
      messageTs: thinkingTs,
      userId,
      payload,
    });

    const blocks = await buildConfirmationBlocks({
      actionId,
      tool,
      input: draft.displayInput,
      resolvers: makeRefResolvers(workspaceId),
    });
    await slack.chat.update({ channel, ts: thinkingTs, text, blocks });
  }
}
