import { ServiceError } from "@openstatus/services";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";

import { parseActionId } from "./blocks";
import { consume, get } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";
import { renderToolResult } from "./presenters";
import { executeRegistryAction, getRegistryTool } from "./registry-runner";
import { toServiceCtx } from "./service-adapter";
import { resolveWorkspace } from "./workspace-resolver";

interface SlackInteractionPayload {
  type: string;
  user: { id: string };
  channel: { id: string };
  message: { ts: string };
  team?: { id: string };
  actions: Array<{ action_id: string; value?: string }>;
}

export async function handleSlackInteraction(c: Context) {
  const payload = c.get("slackBody") as SlackInteractionPayload;

  if (payload.type !== "block_actions" || !payload.actions?.length) {
    return c.json({ ok: true });
  }

  const parsed = parseActionId(payload.actions[0].action_id);
  if (!parsed) return c.json({ ok: true });

  const channelId = payload.channel.id;
  const messageTs = payload.message.ts;
  const userId = payload.user.id;
  const teamId = payload.team?.id;

  // Non-atomic read for botToken resolution and authorization checks
  const pending = await get(parsed.pendingId);

  let botToken: string | undefined = pending?.botToken;
  if (!botToken && teamId) {
    const resolved = await resolveWorkspace(teamId);
    botToken = resolved?.botToken;
  }
  if (!botToken) return c.json({ ok: true });

  const slack = new WebClient(botToken);

  if (!pending) {
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: ":x: This action has expired. Please try again.",
      blocks: [],
    });
    return c.json({ ok: true });
  }

  if (pending.userId !== userId) {
    await slack.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "Only the person who initiated this action can approve or cancel it.",
    });
    return c.json({ ok: true });
  }

  // Atomic consume — prevents double execution from concurrent requests
  // (e.g. double-click). If another request already won, return.
  const consumed = await consume(parsed.pendingId);
  if (!consumed) return c.json({ ok: true });

  if (parsed.kind === "cancel") {
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: ":no_entry_sign: Cancelled.",
      blocks: [],
    });
    return c.json({ ok: true });
  }

  try {
    await runAndPresent({
      pending: consumed,
      flag: parsed.flag,
      slack,
      channelId,
      messageTs,
      slackUserId: userId,
      teamId,
    });
  } catch (err) {
    console.error("[slack] action execution error:", err);
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: errorMessage(err),
      blocks: [],
    });
  }

  return c.json({ ok: true });
}

async function runAndPresent(args: {
  pending: PendingAction;
  flag: boolean;
  slack: WebClient;
  channelId: string;
  messageTs: string;
  slackUserId: string;
  teamId: string | undefined;
}) {
  const { pending, flag, slack, channelId, messageTs, slackUserId, teamId } =
    args;
  const tool = getRegistryTool(pending.payload.toolName);
  if (!tool) {
    throw new Error(
      `slack: unknown tool "${pending.payload.toolName}" in pending payload`,
    );
  }

  const ctx = await toServiceCtx({ pending, slackUserId, teamId });
  const flagId = tool.approval?.extraFlags?.[0]?.id;
  const flags: Record<string, boolean> = flagId ? { [flagId]: flag } : {};

  const { input, output } = await executeRegistryAction({
    tool,
    ctx,
    draftInput: pending.payload.input,
    flags,
  });

  // Soft contract: tools that declare `extraFlags: [{ id: "notify" }]`
  // SHOULD return `notified: boolean` in their output (see ExtraFlag
  // JSDoc). We read it here because services swallow dispatch failures —
  // falling back to the user's button flag would say "subscribers
  // notified" when dispatch actually failed. The `?? false` keeps us
  // honest if a future tool breaks the convention.
  const notified =
    flagId === "notify"
      ? ((output as { notified?: boolean }).notified ?? false)
      : false;
  const text = await renderToolResult({
    tool,
    ctx,
    input,
    output,
    notify: notified,
  });

  await slack.chat.update({
    channel: channelId,
    ts: messageTs,
    text,
    blocks: [],
  });
}

function errorMessage(err: unknown): string {
  if (err instanceof ServiceError) {
    return `:x: ${err.message}`;
  }
  return ":x: Something went wrong. Please try again.";
}
