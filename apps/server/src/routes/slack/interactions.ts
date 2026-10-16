import { getLogger } from "@logtape/logtape";
import { ServiceError } from "@openstatus/services";
import { INCIDENT_CARD_ACTIONS } from "@openstatus/services/incident";
import { WebClient } from "@slack/web-api";
import type { Context } from "hono";

import { runInBackground } from "@/libs/background";

import {
  buildLinkAccountBlocks,
  LINK_ACCOUNT_TEXT,
  type ParsedActionId,
  parseActionId,
} from "./blocks";
import type { SlackConfig, SlackEnv } from "./config";
import { consume, get, recordCreated } from "./confirmation-store";
import type { PendingAction } from "./confirmation-store";
import { catchUpChannel } from "./handler";
import { OPEN_DECLARE_INCIDENT_ACTION } from "./home";
import {
  changeStatusPagePage,
  type IncidentCardAction,
  openIncidentCardModal,
  openPublishStatusUpdateModal,
  openReportFollowUpModal,
  openReportUpdateModal,
  settleFollowUp,
  STATUS_PAGE_CALLBACK,
  STATUS_PAGE_PAGE_ACTION,
  submitStatusPage,
  submitUpdateStatus,
  UPDATE_STATUS_CALLBACK,
} from "./incident-card";
import {
  ADD_TO_TIMELINE_CALLBACK,
  handleAddToTimeline,
  type SlackMessage,
} from "./incident-events";
import {
  DECLARE_INCIDENT_CALLBACK,
  DECLARE_INCIDENT_FROM_MESSAGE_CALLBACK,
  NOT_CONNECTED,
  openDeclareIncidentModal,
  type StateValues,
  submitDeclareIncident,
  type ViewSubmissionPayload,
  type ViewSubmissionResponse,
} from "./incident-modal";
import {
  afterIncidentTool,
  bindChannelFromButton,
  INCIDENT_BIND_ACTION_PREFIX,
  INCIDENT_RELINK_ACTION,
  relinkIncidentChannel,
} from "./incident-slack";
import { NEXT_STEP_ACTIONS, nextStepBlocks } from "./next-steps";
import { renderToolResult } from "./presenters";
import { executeRegistryAction, getRegistryTool } from "./registry-runner";
import { loadDraft } from "./report-draft";
import {
  readFollowUpValue,
  REPORT_FOLLOW_UP_CREATE,
  REPORT_FOLLOW_UP_SKIP,
} from "./report-follow-up";
import {
  linkAccountUrl,
  planRequiredMessage,
  requireSlackMember,
  type SlackActor,
  slackAgentAllowed,
} from "./require-slack-member";
import { deleteOriginal, respondLater } from "./response-url";
import { toServiceCtx } from "./service-adapter";
import { createdRecordFrom } from "./thread-memory";
import {
  CATCH_UP_ACTION,
  PUBLISH_STATUS_UPDATE_ACTION,
  WELCOME_ACTIONS,
} from "./welcome";
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

const TIMELINE_UNAVAILABLE =
  "Couldn't read that message from Slack. Please try again.";

interface WelcomeClick {
  response_url?: string;
  container?: { is_ephemeral?: boolean };
  team?: { id: string };
  user?: { id: string; team_id?: string };
  channel?: { id: string };
  actions?: Array<{ action_id: string }>;
}

interface SlackShortcutPayload {
  type: "shortcut" | "message_action" | "block_actions";
  callback_id: string;
  trigger_id: string;
  response_url?: string;
  user?: { id: string; team_id?: string };
  team?: { id: string };
  channel?: { id: string };
  message?: SlackMessage;
}

async function handleShortcut(
  c: Context<SlackEnv>,
  payload: SlackShortcutPayload,
) {
  const teamId = payload.team?.id ?? payload.user?.team_id;
  if (payload.callback_id === ADD_TO_TIMELINE_CALLBACK) {
    const { user, channel, message, response_url } = payload;
    if (!response_url) {
      logger.warn("slack timeline shortcut without a response_url", { teamId });
    } else if (!teamId || !user?.id || !channel?.id || !message?.ts) {
      logger.warn("slack timeline shortcut with an incomplete payload", {
        teamId,
      });
      runInBackground(
        "add-to-timeline",
        () => respondLater(response_url, { text: TIMELINE_UNAVAILABLE }),
        { teamId },
      );
    } else {
      const config = c.get("slackConfig");
      const ts = message.ts;
      runInBackground(
        "add-to-timeline",
        async () => {
          const resolved = await resolveWorkspace(teamId);
          if (!resolved) {
            await respondLater(response_url, { text: NOT_CONNECTED });
            return;
          }
          await handleAddToTimeline({
            resolved,
            config,
            teamId,
            slackUserId: user.id,
            channel: channel.id,
            message: { ...message, ts },
            responseUrl: response_url,
          });
        },
        { teamId },
      );
    }
    return c.body(null, 200);
  }
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

const CARD_BUTTONS: Record<string, IncidentCardAction> = {
  [INCIDENT_CARD_ACTIONS.updateStatus]: "update_status",
  [INCIDENT_CARD_ACTIONS.statusPage]: "status_page",
};

/** Each form's submit, and the field an unexpected failure is shown on. */
const MODAL_SUBMITS: Record<
  string,
  {
    submit: (
      payload: ViewSubmissionPayload,
      config: SlackConfig,
    ) => Promise<ViewSubmissionResponse>;
    errorField: string;
  }
> = {
  [DECLARE_INCIDENT_CALLBACK]: {
    submit: submitDeclareIncident,
    errorField: "title",
  },
  [UPDATE_STATUS_CALLBACK]: {
    submit: submitUpdateStatus,
    errorField: "status",
  },
  [STATUS_PAGE_CALLBACK]: { submit: submitStatusPage, errorField: "message" },
};

interface SlackViewActionPayload {
  team?: { id: string };
  user: { id: string; team_id?: string };
  trigger_id?: string;
  channel?: { id: string };
  message?: { ts: string };
  view?: {
    id: string;
    hash?: string;
    private_metadata?: string;
    state?: { values: StateValues };
  };
  actions: Array<{
    action_id: string;
    value?: string;
    selected_option?: { value: string };
  }>;
}

/** The drafted report card posted after a declare. */
async function handleReportFollowUp(
  payload: SlackViewActionPayload,
  config: SlackConfig,
): Promise<void> {
  const teamId = payload.team?.id ?? payload.user.team_id;
  const action = payload.actions[0];
  const value = readFollowUpValue(action.value);
  const channelId = payload.channel?.id;
  const followUpTs = payload.message?.ts;
  if (!teamId || !value || !channelId || !followUpTs) return;
  if (action.action_id === REPORT_FOLLOW_UP_CREATE) {
    if (!payload.trigger_id) return;
    await openReportFollowUpModal({
      teamId,
      slackUserId: payload.user.id,
      triggerId: payload.trigger_id,
      incidentId: value.incidentId,
      channelId,
      followUpTs,
      draft: value.draftId ? await loadDraft(value.draftId) : undefined,
      config,
    });
    return;
  }
  const resolved = await resolveWorkspace(teamId);
  if (!resolved) return;
  await settleFollowUp({
    slack: new WebClient(resolved.botToken),
    channelId,
    ts: followUpTs,
    text: `Status report skipped by <@${payload.user.id}>.`,
  });
}

/** Card buttons, awaited since `trigger_id` lives 3s, and in-modal selects. */
async function handleIncidentCardAction(
  payload: SlackViewActionPayload,
  config: SlackConfig,
): Promise<void> {
  const teamId = payload.team?.id ?? payload.user.team_id;
  const action = payload.actions[0];
  if (!teamId) return;
  if (action.action_id === STATUS_PAGE_PAGE_ACTION) {
    const pageId = Number(action.selected_option?.value);
    const view = payload.view;
    if (!view || !Number.isInteger(pageId)) return;
    // No trigger_id to keep alive: ack now, redraw the form after.
    runInBackground(
      "incident-card-page",
      () =>
        changeStatusPagePage({
          teamId,
          slackUserId: payload.user.id,
          viewId: view.id,
          hash: view.hash,
          privateMetadata: view.private_metadata,
          pageId,
          startedAt:
            view.state?.values.started_at?.value?.selected_date_time ??
            undefined,
          config,
        }),
      { teamId },
    );
    return;
  }
  const incidentId = Number(action.value);
  if (!payload.trigger_id || !Number.isInteger(incidentId)) return;
  await openIncidentCardModal({
    action: CARD_BUTTONS[action.action_id],
    teamId,
    slackUserId: payload.user.id,
    triggerId: payload.trigger_id,
    incidentId,
    channelId: payload.channel?.id,
    messageTs: payload.message?.ts,
    config,
  });
}

export async function handleSlackInteraction(c: Context<SlackEnv>) {
  const body = c.get("slackBody") as { type?: string };
  const config = c.get("slackConfig");

  if (body.type === "shortcut" || body.type === "message_action") {
    return handleShortcut(c, body as SlackShortcutPayload);
  }
  if (body.type === "view_submission") {
    const submission = body as ViewSubmissionPayload;
    const callbackId = submission.view?.callback_id;
    const modal = callbackId ? MODAL_SUBMITS[callbackId] : undefined;
    if (!modal) return c.body(null, 200);
    // A field error keeps the form open with what the user typed.
    const response = await modal
      .submit(submission, config)
      .catch((error): ViewSubmissionResponse => {
        logger.error("slack modal submit failed", { error, callbackId });
        return {
          response_action: "errors",
          errors: {
            [modal.errorField]: "Something went wrong. Please try again.",
          },
        };
      });
    return response ? c.json(response) : c.body(null, 200);
  }

  const payload = body as SlackInteractionPayload;
  const welcome = body as WelcomeClick;
  if (
    welcome.response_url &&
    welcome.container?.is_ephemeral &&
    WELCOME_ACTIONS.has(welcome.actions?.[0]?.action_id ?? "")
  ) {
    const responseUrl = welcome.response_url;
    runInBackground("welcome-dismiss", () => deleteOriginal(responseUrl), {
      teamId: welcome.team?.id,
    });
  }
  if (payload.actions?.[0]?.action_id === CATCH_UP_ACTION) {
    const teamId = welcome.team?.id ?? welcome.user?.team_id;
    const channelId = welcome.channel?.id;
    const slackUserId = welcome.user?.id;
    if (teamId && channelId && slackUserId) {
      runInBackground(
        "welcome-catch-up",
        () => catchUpChannel({ teamId, channelId, slackUserId, config }),
        { teamId, channelId },
      );
    }
    return c.json({ ok: true });
  }
  if (payload.actions?.[0]?.action_id === OPEN_DECLARE_INCIDENT_ACTION) {
    return handleShortcut(c, {
      ...(body as SlackShortcutPayload),
      callback_id: DECLARE_INCIDENT_CALLBACK,
    });
  }
  const actionId = payload.actions?.[0]?.action_id;
  if (actionId === PUBLISH_STATUS_UPDATE_ACTION) {
    const shortcut = body as SlackShortcutPayload;
    const teamId = shortcut.team?.id ?? shortcut.user?.team_id;
    if (teamId && shortcut.user?.id) {
      // Awaited, not backgrounded: `trigger_id` dies with the 3s ack window.
      await openPublishStatusUpdateModal({
        teamId,
        slackUserId: shortcut.user.id,
        triggerId: shortcut.trigger_id,
        channelId: shortcut.channel?.id,
        config,
      }).catch((error) =>
        logger.error("slack publish status update modal failed", {
          error,
          teamId,
        }),
      );
    }
    return c.json({ ok: true });
  }
  if (
    actionId === NEXT_STEP_ACTIONS.postUpdate ||
    actionId === NEXT_STEP_ACTIONS.resolve
  ) {
    const action = body as SlackViewActionPayload;
    const teamId = action.team?.id ?? action.user.team_id;
    const statusReportId = Number(action.actions[0]?.value);
    if (teamId && action.trigger_id && Number.isInteger(statusReportId)) {
      // Awaited, not backgrounded: `trigger_id` dies with the 3s ack window.
      await openReportUpdateModal({
        teamId,
        slackUserId: action.user.id,
        triggerId: action.trigger_id,
        statusReportId,
        channelId: action.channel?.id,
        resolve: actionId === NEXT_STEP_ACTIONS.resolve,
        config,
      }).catch((error) =>
        logger.error("slack next step modal failed", { error, actionId }),
      );
    }
    return c.json({ ok: true });
  }
  if (
    actionId === REPORT_FOLLOW_UP_CREATE ||
    actionId === REPORT_FOLLOW_UP_SKIP
  ) {
    await handleReportFollowUp(body as SlackViewActionPayload, config).catch(
      (error) =>
        logger.error("slack report follow-up action failed", {
          error,
          actionId,
        }),
    );
    return c.json({ ok: true });
  }
  if (
    actionId &&
    (actionId in CARD_BUTTONS || actionId === STATUS_PAGE_PAGE_ACTION)
  ) {
    await handleIncidentCardAction(
      body as SlackViewActionPayload,
      config,
    ).catch((error) =>
      logger.error("slack incident card action failed", { error, actionId }),
    );
    return c.json({ ok: true });
  }
  if (payload.type !== "block_actions" || !payload.actions?.length) {
    return c.json({ ok: true });
  }

  if (payload.actions[0].action_id === INCIDENT_RELINK_ACTION) {
    const teamId = payload.team?.id;
    if (teamId) {
      runInBackground(
        "incident-relink",
        async () => {
          const resolved = await resolveWorkspace(teamId);
          if (!resolved) return;
          await relinkIncidentChannel({
            resolved,
            config,
            teamId,
            slackUserId: payload.user.id,
            channelId: payload.channel.id,
            messageTs: payload.message.ts,
            value: payload.actions[0].value,
          });
        },
        { teamId },
      );
    }
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

  const ctx = await toServiceCtx({
    pending,
    actor,
    slack,
    channelId,
    messageTs,
  });
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
    blocks:
      (typeof output === "object" && output !== null
        ? nextStepBlocks(tool.name, output, text)
        : undefined) ?? [],
  });

  const created =
    typeof output === "object" && output !== null
      ? createdRecordFrom(tool.name, output)
      : undefined;
  if (created) {
    await recordCreated(pending.threadTs, created).catch((error) =>
      logger.warn("slack created record failed", { error, ...created }),
    );
  }

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
