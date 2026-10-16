import { getLogger } from "@logtape/logtape";
import {
  type ServiceContext,
  ServiceError,
  withTransaction,
} from "@openstatus/services";
import {
  addIncidentNote,
  allowedTransitions,
  announceIncidentChange,
  escapeMrkdwn,
  getIncident,
  headerBlocks,
  quoteNote,
  setIncidentStatus,
  updateIncident,
} from "@openstatus/services/incident";
import { listPages } from "@openstatus/services/page";
import { listPageComponents } from "@openstatus/services/page-component";
import { notifyStatusReport } from "@openstatus/services/status-report";
import { type ModalView, WebClient } from "@slack/web-api";
import { z } from "zod";

import { runInBackground } from "@/libs/background";

import type { SlackConfig } from "./config";
import { trackSlackIncident } from "./incident-analytics";
import {
  gate,
  noticeModal,
  type StateValues,
  type ViewSubmissionPayload,
  type ViewSubmissionResponse,
} from "./incident-modal";
import { afterIncidentTool, who } from "./incident-slack";
import { renderToolResult } from "./presenters";
import { executeRegistryAction, getRegistryTool } from "./registry-runner";

const logger = getLogger(["api-server", "slack", "incident-card"]);

export const UPDATE_STATUS_CALLBACK = "incident_card_update_status";
export const STATUS_PAGE_CALLBACK = "incident_card_status_page";
/** The status page select; picking a page reloads its components. */
export const STATUS_PAGE_PAGE_ACTION = "incident_card_page";

const UPDATE_STATUS_TITLE = "Update incident";
const STATUS_PAGE_TITLE = "Update status page";
const GONE = "This incident no longer exists.";
const NOTE_MAX = 3000;
const TITLE_MAX = 256;
// Slack caps option text at 75 chars and a select at 100 options.
const OPTION_TEXT_MAX = 75;
const OPTIONS_MAX = 100;

const INCIDENT_STATUSES = {
  open: "Open — still investigating",
  mitigated: "Mitigated — impact stopped, not fixed yet",
  resolved: "Resolved — fixed",
  canceled: "Canceled — false alarm, closes the incident",
} as const;
type IncidentStatus = keyof typeof INCIDENT_STATUSES;

const SEVERITIES = {
  critical: "Critical — major outage or data loss",
  major: "Major — significant degradation",
  minor: "Minor — limited impact",
} as const;
type Severity = keyof typeof SEVERITIES;

const REPORT_STATUSES = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
} as const;
type ReportStatus = keyof typeof REPORT_STATUSES;

const IMPACTS = {
  degraded_performance: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
} as const;
type Impact = keyof typeof IMPACTS;

const metadataSchema = z.object({
  // Absent for a status page update published outside any incident.
  incidentId: z.number().int().optional(),
  channelId: z.string().optional(),
  messageTs: z.string().optional(),
  statusReportId: z.number().int().optional(),
});
type Metadata = z.infer<typeof metadataSchema>;

function readMetadata(raw: string | undefined): Metadata | undefined {
  try {
    return metadataSchema.safeParse(JSON.parse(raw || "{}")).data;
  } catch {
    return undefined;
  }
}

function option(value: string, label: string) {
  return {
    text: {
      type: "plain_text" as const,
      text: label.slice(0, OPTION_TEXT_MAX),
    },
    value,
  };
}

function options<K extends string>(labels: Record<K, string>, keys?: K[]) {
  return (keys ?? (Object.keys(labels) as K[])).map((k) =>
    option(k, labels[k]),
  );
}

function pick<K extends string>(
  labels: Record<K, string>,
  value: string | undefined,
): K | undefined {
  return value !== undefined && value in labels ? (value as K) : undefined;
}

type Incident = NonNullable<Awaited<ReturnType<typeof getIncident>>>;

export function buildUpdateStatusModal(
  incident: Incident,
  meta: Metadata,
): ModalView {
  if (incident.closedAt) {
    return noticeModal(
      "This incident is closed.",
      undefined,
      UPDATE_STATUS_TITLE,
    );
  }
  const statuses = [incident.status, ...allowedTransitions(incident)];
  return {
    type: "modal",
    callback_id: UPDATE_STATUS_CALLBACK,
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: UPDATE_STATUS_TITLE },
    submit: { type: "plain_text", text: "Update" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${escapeMrkdwn(incident.title)}*` },
      },
      {
        type: "input",
        block_id: "status",
        label: { type: "plain_text", text: "Status" },
        element: {
          type: "static_select",
          action_id: "value",
          options: options(INCIDENT_STATUSES, statuses),
          initial_option: option(
            incident.status,
            INCIDENT_STATUSES[incident.status],
          ),
        },
      },
      {
        type: "input",
        block_id: "severity",
        label: { type: "plain_text", text: "Severity" },
        element: {
          type: "static_select",
          action_id: "value",
          options: options(SEVERITIES),
          initial_option: option(
            incident.severity,
            SEVERITIES[incident.severity],
          ),
        },
      },
      {
        type: "input",
        block_id: "note",
        optional: true,
        label: { type: "plain_text", text: "Update" },
        hint: {
          type: "plain_text",
          text: "Posted in the channel and added to the timeline.",
        },
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          max_length: NOTE_MAX,
          placeholder: { type: "plain_text", text: "What changed?" },
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Internal only: use *Update status page* to tell your users.",
          },
        ],
      },
    ],
  };
}

type PageOption = { id: number; title: string };
type ComponentOption = { id: number; name: string };

const notifyBlock = {
  type: "input" as const,
  block_id: "notify",
  optional: true,
  label: { type: "plain_text" as const, text: "Subscribers" },
  element: {
    type: "checkboxes" as const,
    action_id: "value",
    options: [option("notify", "Notify subscribers")],
  },
};

function messageBlock(placeholder: string) {
  return {
    type: "input" as const,
    block_id: "message",
    label: { type: "plain_text" as const, text: "Message" },
    element: {
      type: "plain_text_input" as const,
      action_id: "value",
      multiline: true,
      max_length: NOTE_MAX,
      placeholder: { type: "plain_text" as const, text: placeholder },
    },
  };
}

/** Adds an update to the incident's linked report. */
export function buildStatusReportUpdateModal(
  report: NonNullable<Incident["statusReport"]>,
  meta: Metadata,
): ModalView {
  return {
    type: "modal",
    callback_id: STATUS_PAGE_CALLBACK,
    private_metadata: JSON.stringify({ ...meta, statusReportId: report.id }),
    title: { type: "plain_text", text: STATUS_PAGE_TITLE },
    submit: { type: "plain_text", text: "Publish" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${escapeMrkdwn(report.title)}* · ${report.status}`,
        },
      },
      {
        type: "input",
        block_id: "status",
        label: { type: "plain_text", text: "Status" },
        element: {
          type: "static_select",
          action_id: "value",
          options: options(REPORT_STATUSES),
          initial_option: option(report.status, REPORT_STATUSES[report.status]),
        },
      },
      messageBlock("We have identified the cause and are rolling out a fix."),
      notifyBlock,
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: ":warning: Public: shown on your status page.",
          },
        ],
      },
    ],
  };
}

/** Creates a status report, linked to the incident when there is one. */
export function buildStatusReportCreateModal(args: {
  incident?: Incident;
  pages: PageOption[];
  pageId: number;
  components: ComponentOption[];
  meta: Metadata;
}): ModalView {
  const { incident, pages, pageId, components, meta } = args;
  const page = pages.find((p) => p.id === pageId) ?? pages[0];
  const componentBlocks = components.length
    ? [
        {
          type: "input" as const,
          // Keyed by page so a page switch drops the previous page's picks.
          block_id: `components_${page.id}`,
          optional: true,
          label: { type: "plain_text" as const, text: "Affected components" },
          element: {
            type: "multi_static_select" as const,
            action_id: "value",
            placeholder: {
              type: "plain_text" as const,
              text: "Pick components",
            },
            options: components
              .slice(0, OPTIONS_MAX)
              .map((c) => option(String(c.id), c.name)),
          },
        },
        {
          type: "input" as const,
          block_id: "impact",
          optional: true,
          label: { type: "plain_text" as const, text: "Impact" },
          hint: {
            type: "plain_text" as const,
            text: "Applied to every affected component.",
          },
          element: {
            type: "static_select" as const,
            action_id: "value",
            options: options(IMPACTS),
            initial_option: option("partial_outage", IMPACTS.partial_outage),
          },
        },
      ]
    : [];
  return {
    type: "modal",
    callback_id: STATUS_PAGE_CALLBACK,
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: STATUS_PAGE_TITLE },
    submit: { type: "plain_text", text: "Publish" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "page",
        dispatch_action: true,
        label: { type: "plain_text", text: "Status page" },
        element: {
          type: "static_select",
          action_id: STATUS_PAGE_PAGE_ACTION,
          options: pages
            .slice(0, OPTIONS_MAX)
            .map((p) => option(String(p.id), p.title)),
          initial_option: option(String(page.id), page.title),
        },
      },
      {
        type: "input",
        block_id: "title",
        label: { type: "plain_text", text: "Title" },
        element: {
          type: "plain_text_input",
          action_id: "value",
          max_length: TITLE_MAX,
          ...(incident
            ? { initial_value: incident.title.slice(0, TITLE_MAX) }
            : {
                placeholder: {
                  type: "plain_text" as const,
                  text: "Elevated API error rates",
                },
              }),
        },
      },
      {
        type: "input",
        block_id: "status",
        label: { type: "plain_text", text: "Status" },
        element: {
          type: "static_select",
          action_id: "value",
          options: options(REPORT_STATUSES, [
            "investigating",
            "identified",
            "monitoring",
          ]),
          initial_option: option(
            "investigating",
            REPORT_STATUSES.investigating,
          ),
        },
      },
      ...componentBlocks,
      messageBlock("We are investigating elevated error rates."),
      notifyBlock,
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: incident
              ? ":warning: Public: published on your status page and linked to this incident."
              : ":warning: Public: published on your status page.",
          },
        ],
      },
    ],
  };
}

async function statusPageModal(
  ctx: ServiceContext,
  incident: Incident | undefined,
  meta: Metadata,
  pageId?: number,
): Promise<ModalView> {
  if (incident?.statusReport) {
    return buildStatusReportUpdateModal(incident.statusReport, meta);
  }
  if (incident?.closedAt) {
    return noticeModal(
      "This incident is closed.",
      undefined,
      STATUS_PAGE_TITLE,
    );
  }
  const pages = await listPages({ ctx, input: { order: "asc" } });
  if (pages.length === 0) {
    return noticeModal(
      "Create a status page in openstatus first.",
      undefined,
      STATUS_PAGE_TITLE,
    );
  }
  const page = pages.find((p) => p.id === pageId) ?? pages[0];
  const components = await listPageComponents({
    ctx,
    input: { pageId: page.id, order: "asc" },
  });
  return buildStatusReportCreateModal({
    incident,
    pages: pages.map((p) => ({ id: p.id, title: p.title })),
    pageId: page.id,
    components: components.map((c) => ({ id: c.id, name: c.name })),
    meta,
  });
}

export type IncidentCardAction = "update_status" | "status_page";

/** Opens a card button's modal; awaited, since `trigger_id` lives 3s. */
export async function openIncidentCardModal(args: {
  action: IncidentCardAction;
  teamId: string;
  slackUserId: string;
  triggerId: string;
  incidentId: number;
  channelId?: string;
  messageTs?: string;
  config: SlackConfig;
}): Promise<void> {
  const title =
    args.action === "update_status" ? UPDATE_STATUS_TITLE : STATUS_PAGE_TITLE;
  const checked = await gate(args.teamId, args.slackUserId, args.config, title);
  if (!checked.ok) {
    if (!checked.botToken) return;
    await new WebClient(checked.botToken).views.open({
      trigger_id: args.triggerId,
      view: checked.view,
    });
    return;
  }
  const ctx: ServiceContext = {
    workspace: checked.resolved.workspace,
    actor: checked.actor,
  };
  const meta: Metadata = {
    incidentId: args.incidentId,
    channelId: args.channelId,
    messageTs: args.messageTs,
  };
  const incident = await getIncident({ ctx, input: { id: args.incidentId } });
  const view = !incident
    ? noticeModal(GONE, undefined, title)
    : args.action === "update_status"
      ? buildUpdateStatusModal(incident, meta)
      : await statusPageModal(ctx, incident, meta);
  await new WebClient(checked.resolved.botToken).views.open({
    trigger_id: args.triggerId,
    view,
  });
}

/** Opens the form to publish a status report that belongs to no incident. */
export async function openPublishStatusUpdateModal(args: {
  teamId: string;
  slackUserId: string;
  triggerId: string;
  channelId?: string;
  config: SlackConfig;
}): Promise<void> {
  const checked = await gate(
    args.teamId,
    args.slackUserId,
    args.config,
    STATUS_PAGE_TITLE,
  );
  if (!checked.ok) {
    if (!checked.botToken) return;
    await new WebClient(checked.botToken).views.open({
      trigger_id: args.triggerId,
      view: checked.view,
    });
    return;
  }
  const ctx: ServiceContext = {
    workspace: checked.resolved.workspace,
    actor: checked.actor,
  };
  await new WebClient(checked.resolved.botToken).views.open({
    trigger_id: args.triggerId,
    view: await statusPageModal(ctx, undefined, { channelId: args.channelId }),
  });
}

/** A new status page was picked: reload the form with its components. */
export async function changeStatusPagePage(args: {
  teamId: string;
  slackUserId: string;
  viewId: string;
  hash?: string;
  privateMetadata?: string;
  pageId: number;
  config: SlackConfig;
}): Promise<void> {
  const meta = readMetadata(args.privateMetadata);
  if (!meta) return;
  const checked = await gate(
    args.teamId,
    args.slackUserId,
    args.config,
    STATUS_PAGE_TITLE,
  );
  if (!checked.ok) return;
  const ctx: ServiceContext = {
    workspace: checked.resolved.workspace,
    actor: checked.actor,
  };
  let incident: Incident | undefined;
  if (meta.incidentId !== undefined) {
    const found = await getIncident({ ctx, input: { id: meta.incidentId } });
    if (!found) return;
    incident = found;
  }
  await new WebClient(checked.resolved.botToken).views.update({
    view_id: args.viewId,
    ...(args.hash ? { hash: args.hash } : {}),
    view: await statusPageModal(ctx, incident, meta, args.pageId),
  });
}

type Submitted = {
  ctx: ServiceContext;
  slack: WebClient;
  meta: Metadata;
  teamId: string;
  values: StateValues;
};

async function readSubmission(
  payload: ViewSubmissionPayload,
  config: SlackConfig,
  title: string,
): Promise<Submitted | NonNullable<ViewSubmissionResponse>> {
  const teamId = payload.team?.id ?? payload.user.team_id;
  const meta = readMetadata(payload.view.private_metadata);
  if (!teamId || !meta) {
    return {
      response_action: "update",
      view: noticeModal("Could not read this request.", undefined, title),
    };
  }
  const checked = await gate(teamId, payload.user.id, config, title);
  if (!checked.ok) return { response_action: "update", view: checked.view };
  return {
    ctx: { workspace: checked.resolved.workspace, actor: checked.actor },
    slack: new WebClient(checked.resolved.botToken),
    meta,
    teamId,
    values: payload.view.state.values,
  };
}

function errorText(error: unknown): string {
  return error instanceof ServiceError
    ? error.message
    : "Something went wrong. Please try again.";
}

/** Redraws the pinned card the button was clicked on. Best effort. */
async function refreshCard(
  submitted: Submitted,
  config: SlackConfig,
): Promise<void> {
  const { ctx, slack, meta } = submitted;
  if (meta.incidentId === undefined || !meta.channelId || !meta.messageTs)
    return;
  const incident = await getIncident({ ctx, input: { id: meta.incidentId } });
  if (!incident) return;
  await slack.chat
    .update({
      channel: meta.channelId,
      ts: meta.messageTs,
      text: `Incident: ${incident.title}`,
      blocks: headerBlocks(
        incident,
        `${config.dashboardUrl}/incidents/${incident.id}`,
      ),
    })
    .catch((error) =>
      logger.warn("slack incident card refresh failed", {
        error,
        incidentId: incident.id,
      }),
    );
}

export async function submitUpdateStatus(
  payload: ViewSubmissionPayload,
  config: SlackConfig,
): Promise<ViewSubmissionResponse> {
  const submitted = await readSubmission(payload, config, UPDATE_STATUS_TITLE);
  if (!("ctx" in submitted)) return submitted;
  const { ctx, meta, values } = submitted;

  const status = pick(
    INCIDENT_STATUSES,
    values.status?.value?.selected_option?.value,
  );
  if (!status)
    return { response_action: "errors", errors: { status: "Pick a status." } };
  const severity = pick(
    SEVERITIES,
    values.severity?.value?.selected_option?.value,
  );
  if (!severity) {
    return {
      response_action: "errors",
      errors: { severity: "Pick a severity." },
    };
  }
  const note = values.note?.value?.value?.trim() || undefined;

  const incident =
    meta.incidentId === undefined
      ? undefined
      : await getIncident({ ctx, input: { id: meta.incidentId } });
  if (!incident) {
    return {
      response_action: "update",
      view: noticeModal(GONE, undefined, UPDATE_STATUS_TITLE),
    };
  }
  const statusChanged = status !== incident.status;
  const severityChanged = severity !== incident.severity;
  if (!statusChanged && !severityChanged && !note) {
    return {
      response_action: "errors",
      errors: { note: "Change the status or severity, or write an update." },
    };
  }

  try {
    // One transaction: a refused transition must not leave the severity changed.
    await withTransaction(ctx, async (tx) => {
      const txCtx: ServiceContext = { ...ctx, db: tx };
      if (severityChanged) {
        await updateIncident({
          ctx: txCtx,
          input: { id: incident.id, severity },
        });
      }
      if (statusChanged) {
        await setIncidentStatus({
          ctx: txCtx,
          input: { id: incident.id, status, note },
        });
      } else if (note) {
        await addIncidentNote({
          ctx: txCtx,
          input: { id: incident.id, message: note },
        });
      }
    });
  } catch (error) {
    if (!(error instanceof ServiceError)) {
      logger.error("slack incident update failed", {
        error,
        incidentId: incident.id,
      });
    }
    return { response_action: "errors", errors: { status: errorText(error) } };
  }

  runInBackground(
    "incident-card-status",
    () =>
      afterUpdateStatus({
        submitted,
        config,
        incidentId: incident.id,
        status: statusChanged ? status : undefined,
        severity: severityChanged ? severity : undefined,
        note,
      }),
    { incidentId: incident.id },
  );
  return null;
}

async function afterUpdateStatus(args: {
  submitted: Submitted;
  config: SlackConfig;
  incidentId: number;
  status?: IncidentStatus;
  severity?: Severity;
  note?: string;
}): Promise<void> {
  const { submitted, config, incidentId, status, severity, note } = args;
  const { ctx, slack, meta, teamId } = submitted;
  // Before the follow-up: a canceled incident's channel gets archived.
  await refreshCard(submitted, config);
  if (severity || !status) {
    if (!status && note) trackSlackIncident(ctx, "note");
    const text = severity
      ? `${who(ctx)} changed the severity to *${severity}*.${status ? "" : quoteNote(note)}`
      : `${who(ctx)} posted an update.${quoteNote(note)}`;
    await announceIncidentChange({
      ctx,
      incidentId,
      text,
      clientFor: (token) => new WebClient(token),
      dashboardUrl: config.dashboardUrl,
    });
  }
  if (status && meta.channelId) {
    await afterIncidentTool({
      ctx,
      toolName: "set_incident_status",
      input: { note },
      output: { id: incidentId, status },
      config,
      slack,
      teamId,
      channelId: meta.channelId,
    });
  }
}

type StatusPageWrite = {
  toolName:
    | "create_status_report"
    | "add_status_report_update"
    | "resolve_status_report";
  input: object;
};

function readStatusPageWrite(
  meta: Metadata,
  values: StateValues,
): StatusPageWrite | { error: Record<string, string> } {
  const message = values.message?.value?.value?.trim();
  if (!message)
    return { error: { message: "Write a message for your users." } };
  const status = pick(
    REPORT_STATUSES,
    values.status?.value?.selected_option?.value,
  );
  if (!status) return { error: { status: "Pick a status." } };

  if (meta.statusReportId !== undefined) {
    return status === "resolved"
      ? {
          toolName: "resolve_status_report",
          input: { statusReportId: meta.statusReportId, message },
        }
      : {
          toolName: "add_status_report_update",
          input: { statusReportId: meta.statusReportId, status, message },
        };
  }

  const pageId = Number(
    values.page?.[STATUS_PAGE_PAGE_ACTION]?.selected_option?.value,
  );
  if (!Number.isInteger(pageId))
    return { error: { page: "Pick a status page." } };
  const title = values.title?.value?.value?.trim();
  if (!title) return { error: { title: "Give the report a title." } };
  const componentsKey = Object.keys(values).find((k) =>
    k.startsWith("components_"),
  );
  const componentIds = (
    (componentsKey && values[componentsKey]?.value?.selected_options) ||
    []
  ).map((o) => Number(o.value));
  const impact: Impact =
    pick(IMPACTS, values.impact?.value?.selected_option?.value) ??
    "partial_outage";
  return {
    toolName: "create_status_report",
    input: {
      title,
      status,
      message,
      pageId,
      pageComponentIds: componentIds,
      ...(componentIds.length
        ? {
            componentImpacts: componentIds.map((pageComponentId) => ({
              pageComponentId,
              impact,
            })),
          }
        : {}),
      ...(meta.incidentId !== undefined ? { incidentId: meta.incidentId } : {}),
    },
  };
}

const writtenUpdate = z.union([
  z.object({ initialUpdateId: z.number().int() }),
  z.object({ statusReportUpdateId: z.number().int() }),
]);

async function notifySubscribers(
  ctx: ServiceContext,
  output: unknown,
): Promise<boolean> {
  const parsed = writtenUpdate.safeParse(output);
  if (!parsed.success) return false;
  const statusReportUpdateId =
    "initialUpdateId" in parsed.data
      ? parsed.data.initialUpdateId
      : parsed.data.statusReportUpdateId;
  try {
    await notifyStatusReport({ ctx, input: { statusReportUpdateId } });
    return true;
  } catch (error) {
    logger.warn("slack status page notify failed", {
      error,
      statusReportUpdateId,
    });
    return false;
  }
}

export async function submitStatusPage(
  payload: ViewSubmissionPayload,
  config: SlackConfig,
): Promise<ViewSubmissionResponse> {
  const submitted = await readSubmission(payload, config, STATUS_PAGE_TITLE);
  if (!("ctx" in submitted)) return submitted;
  const { ctx, meta, values } = submitted;

  const write = readStatusPageWrite(meta, values);
  if ("error" in write) {
    return { response_action: "errors", errors: write.error };
  }
  const notify = (values.notify?.value?.selected_options ?? []).some(
    (o) => o.value === "notify",
  );
  const tool = getRegistryTool(write.toolName);
  if (!tool) throw new Error(`slack: "${write.toolName}" tool missing`);

  let result: { input: unknown; output: unknown };
  try {
    result = await executeRegistryAction({
      tool,
      ctx,
      draftInput: write.input,
      // Subscriber fan-out can outlast Slack's 3s window: it runs after the ack.
      flags: { notify: false },
    });
  } catch (error) {
    if (!(error instanceof ServiceError)) {
      logger.error("slack status page update failed", {
        error,
        incidentId: meta.incidentId,
        toolName: write.toolName,
      });
    }
    return { response_action: "errors", errors: { message: errorText(error) } };
  }

  runInBackground(
    "incident-card-status-page",
    async () => {
      const notified = notify && (await notifySubscribers(ctx, result.output));
      const rendered = await renderToolResult({
        tool,
        ctx,
        input: result.input,
        output: result.output,
        notify: notified,
      });
      if (meta.incidentId !== undefined) {
        await announceIncidentChange({
          ctx,
          incidentId: meta.incidentId,
          text: `${who(ctx)} updated the status page.\n${rendered}`,
          clientFor: (token) => new WebClient(token),
          dashboardUrl: config.dashboardUrl,
        });
      } else if (meta.channelId) {
        await submitted.slack.chat.postMessage({
          channel: meta.channelId,
          text: `${who(ctx)} published a status page update.\n${rendered}`,
        });
      }
    },
    { incidentId: meta.incidentId, toolName: write.toolName },
  );
  return null;
}
