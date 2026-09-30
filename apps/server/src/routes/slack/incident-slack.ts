import { getLogger } from "@logtape/logtape";
import { sendIncidentCommander } from "@openstatus/emails";
import { ServiceError, type ServiceContext } from "@openstatus/services";
import {
  announceIncidentChange,
  bindIncidentSlackChannel,
  displayName,
  escapeMrkdwn,
  getIncident,
  openIncidentSlackChannel,
  type SlackClientFactory,
} from "@openstatus/services/incident";
import { WebClient } from "@slack/web-api";
import { z } from "zod";

import type { SlackConfig } from "./config";
import { postConfirmationCard } from "./confirmation-card";
import { trackSlackIncident } from "./incident-analytics";
import { requireSlackMember, slackAgentAllowed } from "./require-slack-member";
import type { SlackWorkspace } from "./workspace-resolver";

const logger = getLogger(["api-server", "slack", "incident"]);

export const slackClientFor: SlackClientFactory = (token) =>
  new WebClient(token);

export const INCIDENT_BIND_ACTION_PREFIX = "incident_bind_";

const incidentOutput = z.object({ id: z.number().int(), status: z.string() });
const incidentInput = z.object({ note: z.string().optional() });

function who(ctx: ServiceContext): string {
  return ctx.actor.type === "slack" ? `<@${ctx.actor.slackUserId}>` : "Someone";
}

function quote(note: string | undefined): string {
  return note ? `\n>${escapeMrkdwn(note).replaceAll("\n", "\n>")}` : "";
}

const INCIDENT_TOOLS = new Set([
  "declare_incident",
  "update_incident",
  "resolve_incident",
  "set_incident_status",
]);

const postmortemOutput = z.object({
  incidentId: z.number().int(),
  status: z.string(),
});
const approveInput = z.object({ close: z.boolean().optional() });

/** Slack side effects of an approved incident tool call. Best effort. */
export async function afterIncidentTool(args: {
  ctx: ServiceContext;
  toolName: string;
  input: object;
  output: object;
  config: SlackConfig;
  slack: WebClient;
  teamId: string;
  channelId: string;
  threadTs: string;
}): Promise<void> {
  const { ctx, toolName, config } = args;
  if (toolName === "approve_postmortem") {
    const out = postmortemOutput.safeParse(args.output);
    if (!out.success) return;
    const close = approveInput.safeParse(args.input).data?.close !== false;
    trackSlackIncident(ctx, "approved");
    if (close) trackSlackIncident(ctx, "closed");
    await announceIncidentChange({
      ctx,
      incidentId: out.data.incidentId,
      text: close
        ? `${who(ctx)} approved the postmortem and closed the incident.`
        : `${who(ctx)} approved the postmortem.`,
      clientFor: slackClientFor,
      dashboardUrl: config.dashboardUrl,
      archive: close,
    }).catch(() => undefined);
    return;
  }
  if (toolName === "draft_postmortem") {
    trackSlackIncident(ctx, "postmortem", { draftedBy: "agent" });
    return;
  }
  if (!INCIDENT_TOOLS.has(toolName)) return;
  const output = incidentOutput.safeParse(args.output);
  if (!output.success) return;
  const incidentId = output.data.id;
  const status = output.data.status;
  const note = incidentInput.safeParse(args.input).data?.note;
  try {
    if (toolName === "declare_incident") {
      trackSlackIncident(ctx, "declare");
      await notifyCommander(ctx, incidentId, config).catch((error) =>
        logger.warn("incident commander email failed", { error, incidentId }),
      );
      const result = await openIncidentSlackChannel({
        ctx,
        incidentId,
        clientFor: slackClientFor,
        dashboardUrl: config.dashboardUrl,
      });
      logger.info("slack incident channel", { incidentId, ...result });
      return;
    }
    if (toolName === "update_incident") {
      await announceIncidentChange({
        ctx,
        incidentId,
        text: `${who(ctx)} updated the incident.`,
        clientFor: slackClientFor,
        dashboardUrl: config.dashboardUrl,
      });
      return;
    }

    trackSlackIncident(ctx, "status", { status });
    const closed = status === "resolved" || status === "canceled";
    const row = closed
      ? await getIncident({ ctx, input: { id: incidentId } })
      : undefined;
    const report =
      row?.statusReport && row.statusReport.status !== "resolved"
        ? row.statusReport
        : undefined;
    // An archived channel can't take the resolve card, so keep it open.
    const cardInIncidentChannel =
      !!report && row?.slackChannelId === args.channelId;
    await announceIncidentChange({
      ctx,
      incidentId,
      text: `${who(ctx)} marked the incident *${status}*.${quote(note)}`,
      clientFor: slackClientFor,
      dashboardUrl: config.dashboardUrl,
      archive: status === "canceled" && !cardInIncidentChannel,
    });
    if (report) {
      await offerStatusReportResolve({
        ...args,
        statusReportId: report.id,
        note,
        status,
      });
    }
  } catch (error) {
    logger.warn("slack incident follow-up failed", { error, incidentId });
  }
}

/** A linked status report still open gets a resolve card; never automatic. */
async function offerStatusReportResolve(args: {
  ctx: ServiceContext;
  slack: WebClient;
  teamId: string;
  channelId: string;
  threadTs: string;
  statusReportId: number;
  note: string | undefined;
  status: string;
}): Promise<void> {
  if (args.ctx.actor.type !== "slack") return;
  await postConfirmationCard({
    slack: args.slack,
    ctx: args.ctx,
    teamId: args.teamId,
    channel: args.channelId,
    threadTs: args.threadTs,
    slackUserId: args.ctx.actor.slackUserId,
    toolName: "resolve_status_report",
    input: {
      statusReportId: args.statusReportId,
      message:
        args.note ??
        (args.status === "resolved"
          ? "This incident has been resolved."
          : "This was a false alarm. Everything is operating normally."),
    },
  });
}

async function notifyCommander(
  ctx: ServiceContext,
  incidentId: number,
  config: SlackConfig,
): Promise<void> {
  const row = await getIncident({ ctx, input: { id: incidentId } });
  const commander = row?.commander;
  const actorUserId = ctx.actor.type === "slack" ? ctx.actor.userId : null;
  if (!row || !commander?.email || commander.id === actorUserId) return;
  const declarer = row.declaredByUser ? displayName(row.declaredByUser) : null;
  await sendIncidentCommander({
    to: commander.email,
    incidentTitle: row.title,
    severity: row.severity,
    workspaceName: ctx.workspace.name ?? ctx.workspace.slug,
    assignedBy: declarer ?? "A teammate",
    url: `${config.dashboardUrl}/incidents/${row.id}`,
    idempotencyKey: `incident-commander:${row.id}:${commander.id}:${row.updatedAt.getTime()}`,
  }).catch(() => undefined);
}

/** "Link this channel": the fallback when binding failed during declare. */
export async function bindChannelFromButton(args: {
  resolved: SlackWorkspace;
  teamId: string;
  slackUserId: string;
  channelId: string;
  messageTs: string;
  incidentId: number;
}): Promise<void> {
  const { resolved, teamId, slackUserId, channelId, messageTs, incidentId } =
    args;
  const slack = new WebClient(resolved.botToken);
  if (!slackAgentAllowed(resolved.workspace)) return;
  const actor = await requireSlackMember({
    workspace: resolved.workspace,
    teamId,
    slackUserId,
    slack,
  });
  if (!actor) {
    await slack.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text: "Link your openstatus account first: mention @openstatus to get the link.",
    });
    return;
  }
  try {
    await bindIncidentSlackChannel({
      ctx: { workspace: resolved.workspace, actor },
      input: { id: incidentId, teamId, channelId },
    });
  } catch (error) {
    await slack.chat.postEphemeral({
      channel: channelId,
      user: slackUserId,
      text:
        error instanceof ServiceError
          ? `:x: ${error.message}`
          : ":x: Could not link this channel. Please try again.",
    });
    return;
  }
  // The binding has committed: a failed card update must not report failure.
  await slack.chat
    .update({
      channel: channelId,
      ts: messageTs,
      text: ":white_check_mark: This channel is now linked to the incident.",
      blocks: [],
    })
    .catch((error) =>
      logger.warn("slack incident bind card update failed", {
        error,
        incidentId,
      }),
    );
}
