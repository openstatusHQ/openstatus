import { getLogger } from "@logtape/logtape";
import { ServiceError } from "@openstatus/services";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";

import { runInBackground } from "./background";
import { type ParsedActionId, parseActionId } from "./blocks";
import { consume, get } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";
import { renderToolResult } from "./presenters";
import { executeRegistryAction, getRegistryTool } from "./registry-runner";
import { toServiceCtx } from "./service-adapter";
import { resolveWorkspace } from "./workspace-resolver";

const logger = getLogger("api-server");

interface SlackInteractionPayload {
  type: string;
  user: { id: string };
  channel: { id: string };
  message: { ts: string };
  team?: { id: string };
  actions: Array<{ action_id: string; value?: string }>;
}

export function handleSlackInteraction(c: Context) {
  const payload = c.get("slackBody") as SlackInteractionPayload;

  if (payload.type !== "block_actions" || !payload.actions?.length) {
    return c.json({ ok: true });
  }

  const parsed = parseActionId(payload.actions[0].action_id);
  if (!parsed) return c.json({ ok: true });

  // Executing the action writes to the DB and can notify every subscriber of
  // the status page — well past Slack's 3s ack window, which would mark the
  // click as failed even though it worked. Ack now; the card is updated with
  // the outcome when the work finishes.
  runInBackground("interaction", () => processInteraction(parsed, payload), {
    actionId: payload.actions[0].action_id,
    teamId: payload.team?.id,
  });

  return c.json({ ok: true });
}

async function processInteraction(
  parsed: ParsedActionId,
  payload: SlackInteractionPayload,
) {
  const channelId = payload.channel.id;
  const messageTs = payload.message.ts;
  const userId = payload.user.id;
  const teamId = payload.team?.id;

  // Non-atomic read, for the authorization checks below.
  const pending = await get(parsed.pendingId);

  // Resolved at click time, never stored: the token that made the card may
  // have been revoked since. The payload's team is authoritative for who
  // clicked; the pending's is the fallback when Slack omits it.
  const workspaceTeamId = teamId ?? pending?.teamId;
  if (!workspaceTeamId) return;
  const resolved = await resolveWorkspace(workspaceTeamId);
  if (!resolved?.botToken) return;

  const slack = new WebClient(resolved.botToken);

  if (!pending) {
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: ":x: This action has expired. Please try again.",
      blocks: [],
    });
    return;
  }

  // A reinstall, or a second Slack workspace linked to the account, can resolve
  // this click to a workspace other than the one the card was drafted against —
  // executing it would mutate that other workspace's status page.
  if (resolved.workspace.id !== pending.workspaceId) {
    logger.warn("slack action workspace mismatch", {
      channel: channelId,
      teamId: workspaceTeamId,
      pendingWorkspaceId: pending.workspaceId,
      resolvedWorkspaceId: resolved.workspace.id,
    });
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: ":x: This action belongs to a different workspace. Please try again.",
      blocks: [],
    });
    return;
  }

  if (pending.userId !== userId) {
    await slack.chat.postEphemeral({
      channel: channelId,
      user: userId,
      text: "Only the person who initiated this action can approve or cancel it.",
    });
    return;
  }

  // Atomic consume — prevents double execution from concurrent requests
  // (e.g. double-click). If another request already won, return.
  const consumed = await consume(parsed.pendingId);
  if (!consumed) return;

  if (parsed.kind === "cancel") {
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: ":no_entry_sign: Cancelled.",
      blocks: [],
    });
    return;
  }

  try {
    await runAndPresent({
      pending: consumed,
      flag: parsed.flag,
      slack,
      channelId,
      messageTs,
      slackUserId: userId,
      teamId: workspaceTeamId,
    });
  } catch (err) {
    logger.error("slack action execution error", {
      error: err,
      channel: channelId,
      teamId,
      toolName: consumed.payload.toolName,
    });
    await slack.chat.update({
      channel: channelId,
      ts: messageTs,
      text: errorMessage(err),
      blocks: [],
    });
  }
}

async function runAndPresent(args: {
  pending: PendingAction;
  flag: boolean;
  slack: WebClient;
  channelId: string;
  messageTs: string;
  slackUserId: string;
  teamId: string;
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
