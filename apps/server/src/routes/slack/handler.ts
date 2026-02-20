import { env } from "@/env";
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
  // Cleanup old entries
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

function getSlackClient(): WebClient {
  return new WebClient(env.SLACK_BOT_TOKEN);
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

  // Return 200 immediately, process async
  const promise = processEvent(body);
  // Keep the promise alive (Bun/Node won't GC it)
  promise.catch((err) => console.error("Slack event processing error:", err));

  return c.json({ ok: true });
}

async function processEvent(body: SlackEvent) {
  const event = body.event;
  if (!event) return;

  if (event.type !== "app_mention" && event.type !== "message") return;
  if (event.type === "message" && event.bot_id) return; // Ignore bot messages

  const teamId = body.team_id;
  if (!teamId || !event.channel || !event.ts) return;

  const slack = getSlackClient();

  // Get bot user ID early — needed for mention check and message role detection
  const authInfo = await slack.auth.test();
  const botUserId = authInfo.user_id ?? "";

  // For channel messages, only respond if the bot is mentioned or it's a DM
  if (event.type === "message" && event.channel_type !== "im") {
    if (!event.text?.includes(`<@${botUserId}>`)) return;
  }

  const workspace = await resolveWorkspace(teamId);
  if (!workspace) {
    await slack.chat.postMessage({
      channel: event.channel,
      thread_ts: event.thread_ts ?? event.ts,
      text: "This Slack workspace is not connected to an OpenStatus workspace. Please set up the integration first.",
    });
    return;
  }

  const threadTs = event.thread_ts ?? event.ts;

  // Fetch thread history
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

  const result = await runAgent(workspace, thread, botUserId, event.text);

  // Check if any tool returned needsConfirmation
  const confirmationResult = result.toolResults.find(
    (tr) =>
      tr.result &&
      typeof tr.result === "object" &&
      "needsConfirmation" in tr.result &&
      (tr.result as { needsConfirmation: boolean }).needsConfirmation,
  );

  if (confirmationResult) {
    const { params } = confirmationResult.result as {
      needsConfirmation: boolean;
      params: Record<string, unknown>;
    };

    const actionType =
      confirmationResult.toolName as PendingAction["action"]["type"];
    const action = { type: actionType, params } as PendingAction["action"];

    // Check for existing pending action (draft refinement)
    const existing = findByThread(threadTs);
    if (existing) {
      replace(existing.id, action);

      const blocks = buildConfirmationBlocks(existing.id, action);
      await slack.chat.update({
        channel: event.channel,
        ts: existing.messageTs,
        text: getConfirmationText(action),
        blocks,
      });
    } else {
      const confirmMsg = await slack.chat.postMessage({
        channel: event.channel,
        thread_ts: threadTs,
        text: getConfirmationText(action),
        blocks: buildConfirmationBlocks("placeholder", action),
      });

      const messageTs = confirmMsg.ts ?? "";
      const actionId = store({
        workspaceId: workspace.id,
        limits: workspace.limits,
        channelId: event.channel,
        threadTs,
        messageTs,
        userId: event.user ?? "",
        action,
      });

      const blocks = buildConfirmationBlocks(actionId, action);
      await slack.chat.update({
        channel: event.channel,
        ts: messageTs,
        text: getConfirmationText(action),
        blocks,
      });
    }
  } else {
    await slack.chat.postMessage({
      channel: event.channel,
      thread_ts: threadTs,
      text: result.text || "Done!",
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
