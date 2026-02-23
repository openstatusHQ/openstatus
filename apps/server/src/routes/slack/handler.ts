import { and, db, eq } from "@openstatus/db";
import { integration } from "@openstatus/db/src/schema";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";
import { runAgent } from "./agent";
import { buildConfirmationBlocks } from "./blocks";
import { findByThread, replace, store } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";
import { resolveWorkspace } from "./workspace-resolver";

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

interface SlackEvent {
  type: string;
  event?: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    channel_type?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
  };
  event_id?: string;
  team_id?: string;
  challenge?: string;
}

interface ThreadMessage {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
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
  promise.catch((err) => console.error("[slack] event processing error:", err));

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
      console.log(`[slack] cleaned up integration for team ${teamId}`);
    }
    return;
  }

  if (event.type !== "app_mention" && event.type !== "message") return;
  if (event.type === "message" && event.bot_id) return;

  const teamId = body.team_id;
  if (!teamId || !event.channel || !event.ts) return;

  const resolved = await resolveWorkspace(teamId);
  if (!resolved) {
    console.warn(`[slack] no integration found for team ${teamId}`);
    return;
  }

  const slack = new WebClient(resolved.botToken);
  const botUserId = resolved.botUserId;
  const threadTs = event.thread_ts ?? event.ts;

  if (event.type === "message" && event.channel_type !== "im") {
    if (!event.text?.includes(`<@${botUserId}>`)) return;
  }

  const thinkingMsg = await slack.chat.postMessage({
    channel: event.channel,
    thread_ts: threadTs,
    text: ":hourglass_flowing_sand: Thinking...",
  });
  const thinkingTs = thinkingMsg.ts;

  if (!thinkingTs) {
    console.error("[slack] failed to post thinking message — no ts returned");
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

    const result = await runAgent(
      resolved.workspace,
      thread,
      botUserId,
      event.text,
    );

    const confirmationResult = result.toolResults.find(
      (tr) =>
        tr.result &&
        typeof tr.result === "object" &&
        "needsConfirmation" in tr.result &&
        (tr.result as { needsConfirmation: boolean }).needsConfirmation,
    );

    if (confirmationResult) {
      await handleConfirmation(
        slack,
        event.channel,
        threadTs,
        thinkingTs,
        event.user ?? "",
        resolved.workspace,
        resolved.botToken,
        confirmationResult,
      );
    } else {
      await slack.chat.update({
        channel: event.channel,
        ts: thinkingTs,
        text: result.text || "Done!",
      });
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[slack] agent error:", err);
    await slack.chat.update({
      channel: event.channel,
      ts: thinkingTs,
      text: `:x: Something went wrong: ${errMsg}`,
    });
  }
}

async function handleConfirmation(
  slack: WebClient,
  channel: string,
  threadTs: string,
  thinkingTs: string,
  userId: string,
  workspace: { id: number; limits: PendingAction["limits"] },
  botToken: string,
  confirmationResult: { toolName: string; result: unknown },
) {
  const { params } = confirmationResult.result as {
    needsConfirmation: boolean;
    params: Record<string, unknown>;
  };

  const actionType =
    confirmationResult.toolName as PendingAction["action"]["type"];
  const action = { type: actionType, params } as PendingAction["action"];

  const existing = await findByThread(threadTs);
  if (existing) {
    await replace(existing.id, action);

    const blocks = buildConfirmationBlocks(existing.id, action);
    await slack.chat.update({
      channel,
      ts: thinkingTs,
      text: getConfirmationText(action),
      blocks,
    });
    await slack.chat.update({
      channel,
      ts: existing.messageTs,
      text: getConfirmationText(action),
      blocks,
    });
  } else {
    const actionId = await store({
      workspaceId: workspace.id,
      limits: workspace.limits,
      botToken,
      channelId: channel,
      threadTs,
      messageTs: thinkingTs,
      userId,
      action,
    });

    const blocks = buildConfirmationBlocks(actionId, action);
    await slack.chat.update({
      channel,
      ts: thinkingTs,
      text: getConfirmationText(action),
      blocks,
    });
  }
}

function getConfirmationText(action: PendingAction["action"]): string {
  switch (action.type) {
    case "createStatusReport":
      return `Create Status Report: ${action.params.title}`;
    case "addStatusReportUpdate":
      return `Add Status Report Update (${action.params.status})`;
    case "updateStatusReport":
      return `Update Status Report${action.params.title ? `: ${action.params.title}` : ""}`;
    case "resolveStatusReport":
      return "Resolve Status Report";
  }
}
