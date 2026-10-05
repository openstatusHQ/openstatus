import { getLogger } from "@logtape/logtape";
import {
  type ServiceContext,
  ServiceError,
} from "@openstatus/services";
import { escapeMrkdwn } from "@openstatus/services/incident";
import { type ModalView, WebClient } from "@slack/web-api";
import { z } from "zod";

import { runInBackground } from "./background";
import {
  type Block,
  buildLinkAccountBlocks,
  LINK_ACCOUNT_TEXT,
} from "./blocks";
import type { SlackConfig } from "./config";
import { onIncidentDeclared } from "./incident-slack";
import { getIncidentDashboardUrl } from "./page-urls";
import { executeRegistryAction, getRegistryTool } from "./registry-runner";
import {
  linkAccountUrl,
  planRequiredMessage,
  requireSlackMember,
  type SlackActor,
  slackAgentAllowed,
} from "./require-slack-member";
import { resolveSlackMember } from "./resolve-slack-user";
import { resolveWorkspace, type SlackWorkspace } from "./workspace-resolver";

const logger = getLogger(["api-server", "slack", "incident-modal"]);

const NOT_CONNECTED =
  "openstatus isn't connected to this Slack workspace. Connect it from the openstatus dashboard.";

/** Callback id of the global shortcut, the message shortcut and the modal. */
export const DECLARE_INCIDENT_CALLBACK = "declare_incident";
export const DECLARE_INCIDENT_FROM_MESSAGE_CALLBACK =
  "declare_incident_from_message";

const TITLE_MAX = 256;
// Slack rejects the whole view if a plain_text_input's max_length exceeds 3000.
const SUMMARY_MAX = 3000;
const SEVERITIES = [
  { value: "critical", label: "Critical — major outage or data loss" },
  { value: "major", label: "Major — significant degradation" },
  { value: "minor", label: "Minor — limited impact" },
] as const;

type View = ModalView;

type Prefill = { title?: string; summary?: string };

const privateMetadata = z.object({ channelId: z.string().optional() });

function originChannel(metadata: string | undefined): string | undefined {
  try {
    return privateMetadata.safeParse(JSON.parse(metadata || "{}")).data
      ?.channelId;
  } catch {
    return undefined;
  }
}

function option(value: string, label: string) {
  return { text: { type: "plain_text" as const, text: label }, value };
}

export function buildDeclareIncidentModal(args: {
  slackUserId: string;
  channelId?: string;
  prefill?: Prefill;
}): View {
  const { prefill = {} } = args;
  const major = SEVERITIES[1];
  return {
    type: "modal",
    callback_id: DECLARE_INCIDENT_CALLBACK,
    private_metadata: JSON.stringify({ channelId: args.channelId }),
    title: { type: "plain_text", text: "Declare an incident" },
    submit: { type: "plain_text", text: "Declare" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "title",
        label: { type: "plain_text", text: "Title" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          max_length: TITLE_MAX,
          placeholder: { type: "plain_text", text: "API returning 500s" },
          ...(prefill.title
            ? { initial_value: prefill.title.slice(0, TITLE_MAX) }
            : {}),
        },
      },
      {
        type: "input",
        block_id: "severity",
        label: { type: "plain_text", text: "Severity" },
        element: {
          type: "static_select",
          action_id: "value",
          options: SEVERITIES.map((s) => option(s.value, s.label)),
          initial_option: option(major.value, major.label),
        },
      },
      {
        type: "input",
        block_id: "summary",
        optional: true,
        label: { type: "plain_text", text: "Summary" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          max_length: SUMMARY_MAX,
          placeholder: { type: "plain_text", text: "What is happening?" },
          ...(prefill.summary
            ? { initial_value: prefill.summary.slice(0, SUMMARY_MAX) }
            : {}),
        },
      },
      {
        type: "input",
        block_id: "commander",
        optional: true,
        label: { type: "plain_text", text: "Commander" },
        hint: {
          type: "plain_text",
          text: "Leads the response. Defaults to you.",
        },
        element: {
          type: "users_select",
          action_id: "value",
          initial_user: args.slackUserId,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Internal only: nothing is published to your status page.",
          },
        ],
      },
    ],
  };
}

function noticeModal(text: string, blocks?: Block[]): View {
  return {
    type: "modal",
    title: { type: "plain_text", text: "Declare an incident" },
    close: { type: "plain_text", text: "Close" },
    blocks: blocks ?? [{ type: "section", text: { type: "mrkdwn", text } }],
  };
}

type Gate =
  | { ok: true; resolved: SlackWorkspace; actor: SlackActor }
  | { ok: false; view: View; botToken?: string };

/** Everything the modal needs before it can declare; a notice view otherwise. */
async function gate(
  teamId: string,
  slackUserId: string,
  config: SlackConfig,
): Promise<Gate> {
  const resolved = await resolveWorkspace(teamId);
  if (!resolved) {
    return {
      ok: false,
      view: noticeModal(NOT_CONNECTED),
    };
  }
  if (!slackAgentAllowed(resolved.workspace)) {
    return {
      ok: false,
      view: noticeModal(planRequiredMessage(config).text),
      botToken: resolved.botToken,
    };
  }
  const actor = await requireSlackMember({
    workspace: resolved.workspace,
    teamId,
    slackUserId,
    slack: new WebClient(resolved.botToken),
  });
  if (!actor) {
    const url = await linkAccountUrl(config, {
      workspaceId: resolved.workspace.id,
      teamId,
      slackUserId,
    });
    return {
      ok: false,
      view: noticeModal(LINK_ACCOUNT_TEXT, buildLinkAccountBlocks(url)),
      botToken: resolved.botToken,
    };
  }
  return { ok: true, resolved, actor };
}

/**
 * `trigger_id` expires 3s after the user's action. Returns the message to show
 * instead when there is no bot token to open even a notice with.
 */
export async function openDeclareIncidentModal(args: {
  teamId: string;
  slackUserId: string;
  triggerId: string;
  channelId?: string;
  prefill?: Prefill;
  config: SlackConfig;
}): Promise<string | undefined> {
  const { teamId, slackUserId, triggerId, config } = args;
  const checked = await gate(teamId, slackUserId, config);
  if (!checked.ok) {
    if (!checked.botToken) return NOT_CONNECTED;
    await new WebClient(checked.botToken).views.open({
      trigger_id: triggerId,
      view: checked.view,
    });
    return;
  }
  await new WebClient(checked.resolved.botToken).views.open({
    trigger_id: triggerId,
    view: buildDeclareIncidentModal({
      slackUserId,
      channelId: args.channelId,
      prefill: args.prefill,
    }),
  });
}

type StateValues = Record<
  string,
  Record<
    string,
    {
      value?: string | null;
      selected_option?: { value: string } | null;
      selected_user?: string | null;
    }
  >
>;

export type DeclareSubmission = {
  title: string;
  severity: "critical" | "major" | "minor";
  summary?: string;
  commanderSlackUserId?: string;
};

export function parseDeclareSubmission(
  values: StateValues,
): DeclareSubmission | { error: Record<string, string> } {
  const title = values.title?.value?.value?.trim() ?? "";
  if (!title) return { error: { title: "Give the incident a title." } };
  const severity = SEVERITIES.find(
    (s) => s.value === values.severity?.value?.selected_option?.value,
  )?.value;
  if (!severity) return { error: { severity: "Pick a severity." } };
  const summary = values.summary?.value?.value?.trim();
  const commander = values.commander?.value?.selected_user;
  return {
    title,
    severity,
    ...(summary ? { summary } : {}),
    ...(commander ? { commanderSlackUserId: commander } : {}),
  };
}

export type ViewSubmissionPayload = {
  type: "view_submission";
  team?: { id: string };
  user: { id: string; team_id?: string };
  view: {
    callback_id: string;
    private_metadata?: string;
    state: { values: StateValues };
  };
};

export type ViewSubmissionResponse =
  | { response_action: "errors"; errors: Record<string, string> }
  | { response_action: "update"; view: View }
  | null;

/**
 * Declares the incident inside Slack's 3s submission window, so validation
 * errors land on the form; the channel and notifications follow in background.
 */
export async function submitDeclareIncident(
  payload: ViewSubmissionPayload,
  config: SlackConfig,
): Promise<ViewSubmissionResponse> {
  const teamId = payload.team?.id ?? payload.user.team_id;
  if (!teamId) {
    return {
      response_action: "update",
      view: noticeModal("Could not read this request."),
    };
  }
  const slackUserId = payload.user.id;

  const parsed = parseDeclareSubmission(payload.view.state.values);
  if ("error" in parsed) {
    return { response_action: "errors", errors: parsed.error };
  }

  const checked = await gate(teamId, slackUserId, config);
  if (!checked.ok) return { response_action: "update", view: checked.view };
  const { resolved, actor } = checked;
  const slack = new WebClient(resolved.botToken);

  let commanderId = actor.userId;
  if (
    parsed.commanderSlackUserId &&
    parsed.commanderSlackUserId !== slackUserId
  ) {
    const mapped = await resolveSlackMember({
      workspace: resolved.workspace,
      teamId,
      slackUserId: parsed.commanderSlackUserId,
      slack,
    });
    if (mapped === null) {
      return {
        response_action: "errors",
        errors: {
          commander:
            "This person isn't a member of the openstatus workspace, or hasn't linked their account.",
        },
      };
    }
    commanderId = mapped;
  }

  const tool = getRegistryTool("declare_incident");
  if (!tool) throw new Error('slack: "declare_incident" tool missing');
  const ctx: ServiceContext = { workspace: resolved.workspace, actor };
  let incidentId: number;
  try {
    const { output } = await executeRegistryAction({
      tool,
      ctx,
      draftInput: {
        title: parsed.title,
        severity: parsed.severity,
        summary: parsed.summary,
        commanderId,
      },
      flags: {},
    });
    incidentId = (output as { id: number }).id;
  } catch (error) {
    if (error instanceof ServiceError) {
      return { response_action: "errors", errors: { title: error.message } };
    }
    logger.error("slack declare modal failed", { error, teamId });
    return {
      response_action: "errors",
      errors: { title: "Something went wrong. Please try again." },
    };
  }

  const origin = originChannel(payload.view.private_metadata);

  runInBackground(
    "incident-modal-declared",
    async () => {
      const channel = await onIncidentDeclared(ctx, incidentId, config);
      const where =
        channel.status === "bound" || channel.status === "unbound"
          ? ` Join <#${channel.channelId}>.`
          : "";
      const text = `:rotating_light: Declared *${escapeMrkdwn(parsed.title)}* (${parsed.severity}).${where} <${getIncidentDashboardUrl(incidentId)}|Open in openstatus>`;
      if (origin) {
        await slack.chat
          .postEphemeral({ channel: origin, user: slackUserId, text })
          .catch(() => slack.chat.postMessage({ channel: slackUserId, text }));
        return;
      }
      await slack.chat.postMessage({ channel: slackUserId, text });
    },
    { teamId, incidentId },
  );

  return null;
}
