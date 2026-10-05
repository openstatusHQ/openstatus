import { getLogger } from "@logtape/logtape";
import { incidentStatus } from "@openstatus/db/src/schema/incidents/constants";
import { sendIncidentCommander } from "@openstatus/emails";
import { ServiceError, type ServiceContext } from "@openstatus/services";
import {
  actorDisplayName,
  afterIncidentDeclared,
  afterIncidentStatusChanged,
  afterPostmortemApproved,
  announceIncidentChange,
  bindIncidentSlackChannel,
  getIncident,
  type IncidentEffects,
  type OpenChannelResult,
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

const incidentStatusSchema = z.enum(incidentStatus);
const incidentOutput = z.object({
  id: z.number().int(),
  status: incidentStatusSchema,
});
const incidentInput = z.object({ note: z.string().optional() });

function who(ctx: ServiceContext): string {
  return ctx.actor.type === "slack" ? `<@${ctx.actor.slackUserId}>` : "Someone";
}

async function slackEffects(
  ctx: ServiceContext,
  config: SlackConfig,
): Promise<IncidentEffects> {
  return {
    clientFor: slackClientFor,
    dashboardUrl: config.dashboardUrl,
    sendCommanderEmail: sendIncidentCommander,
    actorLabel: who(ctx),
    assignedBy: (await actorDisplayName(ctx)) ?? "A teammate",
  };
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
  closed: z.boolean().optional(),
});

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
    const close = out.data.closed === true;
    trackSlackIncident(ctx, "approved");
    if (close) trackSlackIncident(ctx, "closed");
    await afterPostmortemApproved({
      ctx,
      effects: await slackEffects(ctx, config),
      incidentId: out.data.incidentId,
      closed: close,
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
      await onIncidentDeclared(ctx, incidentId, config);
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
    await afterIncidentStatusChanged({
      ctx,
      effects: await slackEffects(ctx, config),
      incidentId,
      status,
      note,
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

/** Commander email and the incident channel, after any Slack declare. */
export async function onIncidentDeclared(
  ctx: ServiceContext,
  incidentId: number,
  config: SlackConfig,
): Promise<OpenChannelResult> {
  trackSlackIncident(ctx, "declare");
  const incident = await getIncident({ ctx, input: { id: incidentId } });
  const result = (incident &&
    (await afterIncidentDeclared({
      ctx,
      effects: await slackEffects(ctx, config),
      incident,
      openSlackChannel: true,
    }))) ?? { status: "skipped" as const };
  logger.info("slack incident channel", { incidentId, ...result });
  return result;
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
