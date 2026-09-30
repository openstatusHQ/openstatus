import { getLogger } from "@logtape/logtape";
import { ServiceError } from "@openstatus/services";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";

import { runInBackground } from "./background";
import {
  buildLinkAccountBlocks,
  LINK_ACCOUNT_TEXT,
  type ParsedActionId,
  parseActionId,
} from "./blocks";
import type { SlackConfig, SlackEnv } from "./config";
import { consume, get } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";
import {
  DECLARE_INCIDENT_CALLBACK,
  DECLARE_INCIDENT_FROM_MESSAGE_CALLBACK,
  openDeclareIncidentModal,
  submitDeclareIncident,
  type ViewSubmissionPayload,
} from "./incident-modal";
import {
  afterIncidentTool,
  bindChannelFromButton,
  INCIDENT_BIND_ACTION_PREFIX,
} from "./incident-slack";
import { renderToolResult } from "./presenters";
import { executeRegistryAction, getRegistryTool } from "./registry-runner";
import {
  linkAccountUrl,
  planRequiredMessage,
  requireSlackMember,
  type SlackActor,
  slackAgentAllowed,
} from "./require-slack-member";
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

async function processIncidentBind(payload: SlackInteractionPayload) {
  const action = payload.actions[0];
  const incidentId = Number(
    action.action_id.slice(INCIDENT_BIND_ACTION_PREFIX.length),
  );
  const teamId = payload.team?.id;
  if (!teamId || !Number.isInteger(incidentId)) return;
  const resolved = await resolveWorkspace(teamId);
  if (!resolved) return;
  await bindChannelFromButton({
    resolved,
    teamId,
    slackUserId: payload.user.id,
    channelId: action.value ?? payload.channel.id,
    messageTs: payload.message.ts,
    incidentId,
  });
}

interface SlackShortcutPayload {
  type: "shortcut" | "message_action";
  callback_id: string;
  trigger_id: string;
  user?: { id: string; team_id?: string };
  team?: { id: string };
  channel?: { id: string };
  message?: { text?: string };
}

async function handleShortcut(
  c: Context<SlackEnv>,
  payload: SlackShortcutPayload,
) {
  const teamId = payload.team?.id ?? payload.user?.team_id;
  if (
    !teamId ||
    !payload.user?.id ||
    (payload.callback_id !== DECLARE_INCIDENT_CALLBACK &&
      payload.callback_id !== DECLARE_INCIDENT_FROM_MESSAGE_CALLBACK)
  ) {
    return c.body(null, 200);
  }
  // Awaited, not backgrounded: `trigger_id` dies with the 3s ack window.
  await openDeclareIncidentModal({
    teamId,
    slackUserId: payload.user.id,
    triggerId: payload.trigger_id,
    channelId: payload.channel?.id,
    prefill:
      payload.type === "message_action" && payload.message?.text
        ? { summary: payload.message.text }
        : undefined,
    config: c.get("slackConfig"),
  }).catch((error) =>
    logger.error("slack declare modal open failed", { error, teamId }),
  );
  return c.body(null, 200);
}

export async function handleSlackInteraction(c: Context<SlackEnv>) {
  const body = c.get("slackBody") as { type?: string };
  const config = c.get("slackConfig");

  if (body.type === "shortcut" || body.type === "message_action") {
    return handleShortcut(c, body as SlackShortcutPayload);
  }
  if (body.type === "view_submission") {
    const submission = body as ViewSubmissionPayload;
    if (submission.view?.callback_id !== DECLARE_INCIDENT_CALLBACK) {
      return c.body(null, 200);
    }
    const response = await submitDeclareIncident(submission, config);
    return response ? c.json(response) : c.body(null, 200);
  }

  const payload = body as SlackInteractionPayload;
  if (payload.type !== "block_actions" || !payload.actions?.length) {
    return c.json({ ok: true });
  }

  if (payload.actions[0].action_id.startsWith(INCIDENT_BIND_ACTION_PREFIX)) {
    runInBackground("incident-bind", () => processIncidentBind(payload), {
      teamId: payload.team?.id,
    });
    return c.json({ ok: true });
  }

  const parsed = parseActionId(payload.actions[0].action_id);
  if (!parsed) return c.json({ ok: true });

  // Executing the action writes to the DB and can notify every subscriber of
  // the status page — well past Slack's 3s ack window, which would mark the
  // click as failed even though it worked. Ack now; the card is updated with
  // the outcome when the work finishes.
  runInBackground(
    "interaction",
    () => processInteraction(parsed, payload, config),
    {
      actionId: payload.actions[0].action_id,
      teamId: payload.team?.id,
    },
  );

  return c.json({ ok: true });
}

async function processInteraction(
  parsed: ParsedActionId,
  payload: SlackInteractionPayload,
  config: SlackConfig,
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

  // Checked before `consume` so the card stays live while they link. Cancel is
  // exempt: the initiator can always dismiss their own draft.
  let actor: SlackActor | null = null;
  if (parsed.kind !== "cancel") {
    if (!slackAgentAllowed(resolved.workspace)) {
      await slack.chat.postEphemeral({
        channel: channelId,
        user: userId,
        ...planRequiredMessage(config),
      });
      return;
    }
    actor = await requireSlackMember({
      workspace: resolved.workspace,
      teamId: workspaceTeamId,
      slackUserId: userId,
      slack,
    });
    if (!actor) {
      const url = await linkAccountUrl(config, {
        workspaceId: resolved.workspace.id,
        teamId: workspaceTeamId,
        slackUserId: userId,
      });
      await slack.chat.postEphemeral({
        channel: channelId,
        user: userId,
        text: LINK_ACCOUNT_TEXT,
        blocks: buildLinkAccountBlocks(url),
      });
      return;
    }
  }

  // Atomic consume — prevents double execution from concurrent requests
  // (e.g. double-click). If another request already won, return.
  const consumed = await consume(parsed.pendingId);
  if (!consumed) return;

  if (parsed.kind === "cancel" || !actor) {
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
      actor,
      config,
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
  actor: SlackActor;
  config: SlackConfig;
}) {
  const { pending, flag, slack, channelId, messageTs, actor, config } = args;
  const tool = getRegistryTool(pending.payload.toolName);
  if (!tool) {
    throw new Error(
      `slack: unknown tool "${pending.payload.toolName}" in pending payload`,
    );
  }

  const ctx = await toServiceCtx({ pending, actor });
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

  if (
    typeof output === "object" &&
    output !== null &&
    typeof input === "object" &&
    input !== null
  ) {
    runInBackground(
      "incident-follow-up",
      () =>
        afterIncidentTool({
          ctx,
          toolName: tool.name,
          input,
          output,
          config,
          slack,
          teamId: pending.teamId ?? actor.teamId,
          channelId,
          threadTs: pending.threadTs,
        }),
      { toolName: tool.name },
    );
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof ServiceError) {
    return `:x: ${err.message}`;
  }
  return ":x: Something went wrong. Please try again.";
}
