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
  headerBlocks,
  type IncidentEffects,
  incidentEffects,
  type OpenChannelResult,
  openIncidentSlackChannel,
  type SlackClientFactory,
} from "@openstatus/services/incident";
import { type KnownBlock, WebClient } from "@slack/web-api";
import { z } from "zod";

import type { SlackConfig } from "./config";
import { postConfirmationCard } from "./confirmation-card";
import { trackSlackIncident } from "./incident-analytics";
import { postReportFollowUp } from "./report-follow-up";
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

export function who(ctx: ServiceContext): string {
  return ctx.actor.type === "slack" ? `<@${ctx.actor.slackUserId}>` : "Someone";
}

async function slackEffects(
  ctx: ServiceContext,
  config: SlackConfig,
): Promise<IncidentEffects> {
  return incidentEffects({
    clientFor: slackClientFor,
    dashboardUrl: config.dashboardUrl,
    sendCommanderEmail: sendIncidentCommander,
    name: (await actorDisplayName(ctx)) ?? "A teammate",
    actorLabel: who(ctx),
  });
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
  threadTs?: string;
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
      await onIncidentDeclared(ctx, incidentId, config, {
        slack: args.slack,
        channelId: args.channelId,
        threadTs: args.threadTs,
      });
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

export const INCIDENT_RELINK_ACTION = "incident_relink";

const relinkValue = z.object({
  incidentId: z.number().int(),
  from: z.string(),
});

/** Only a channel can become the incident's home, not a DM. */
export function offersRelink(sourceId: string, incidentChannelId: string) {
  return /^[CG]/.test(sourceId) && sourceId !== incidentChannelId;
}

/** `G…` is also a group DM's prefix: ask Slack. Unknown counts as no. */
export async function isSlackChannel(slack: WebClient, channelId: string) {
  const info = await slack.conversations
    .info({ channel: channelId })
    .catch(() => undefined);
  const channel = info?.channel;
  return Boolean(
    channel &&
      (channel.is_channel || channel.is_group) &&
      !channel.is_mpim &&
      !channel.is_im,
  );
}

export function relinkNoticeBlocks(
  incidentId: number,
  incidentChannelId: string,
): KnownBlock[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:rotating_light: Incident #${incidentId} opened in <#${incidentChannelId}>.`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Link this channel instead" },
          action_id: INCIDENT_RELINK_ACTION,
          value: JSON.stringify({ incidentId, from: incidentChannelId }),
        },
      ],
    },
  ];
}

/** Commander email and the incident channel, after any Slack declare. */
export async function onIncidentDeclared(
  ctx: ServiceContext,
  incidentId: number,
  config: SlackConfig,
  source?: { slack: WebClient; channelId?: string; threadTs?: string },
): Promise<OpenChannelResult & { relinkPosted?: boolean }> {
  trackSlackIncident(ctx, "declare");
  const effects = await slackEffects(ctx, config);
  // The incident has committed: a failed read skips the commander email
  // (best effort) but must not keep the channel from opening.
  const incident = await getIncident({ ctx, input: { id: incidentId } }).catch(
    (error: unknown) => {
      logger.warn("slack incident read failed", { error, incidentId });
      return undefined;
    },
  );
  const result = (incident === undefined
    ? await openIncidentSlackChannel({
        ctx,
        incidentId,
        clientFor: effects.clientFor,
        dashboardUrl: effects.dashboardUrl,
      })
    : incident &&
      (await afterIncidentDeclared({
        ctx,
        effects,
        incident,
        openSlackChannel: true,
      }))) ?? { status: "skipped" as const };
  logger.info("slack incident channel", { incidentId, ...result });
  let relinkPosted = false;
  if (
    source?.channelId &&
    result.status === "bound" &&
    offersRelink(source.channelId, result.channelId) &&
    (await isSlackChannel(source.slack, source.channelId))
  ) {
    relinkPosted = await source.slack.chat
      .postMessage({
        channel: source.channelId,
        ...(source.threadTs ? { thread_ts: source.threadTs } : {}),
        text: `Incident #${incidentId} opened in <#${result.channelId}>.`,
        blocks: relinkNoticeBlocks(incidentId, result.channelId),
      })
      .then(() => true)
      .catch((error) => {
        logger.warn("slack relink notice failed", { error, incidentId });
        return false;
      });
  }
  if (source && (result.status === "bound" || result.status === "unbound")) {
    await postReportFollowUp({
      ctx,
      slack: source.slack,
      incidentId,
      channelId: result.channelId,
      sourceChannelId: source.channelId,
    }).catch((error) =>
      logger.warn("slack report follow-up failed", { error, incidentId }),
    );
  }
  return { ...result, relinkPosted };
}

/** A linked status report still open gets a resolve card; never automatic. */
async function offerStatusReportResolve(args: {
  ctx: ServiceContext;
  slack: WebClient;
  teamId: string;
  channelId: string;
  threadTs?: string;
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

/**
 * "Link this channel instead": the incident moves to the channel it was
 * declared in, and the channel opened for it is archived.
 */
export async function relinkIncidentChannel(args: {
  resolved: SlackWorkspace;
  config: SlackConfig;
  teamId: string;
  slackUserId: string;
  channelId: string;
  messageTs: string;
  value: string | undefined;
}): Promise<void> {
  const { resolved, config, teamId, slackUserId, channelId, messageTs } = args;
  let parsed: z.infer<typeof relinkValue> | undefined;
  try {
    parsed = relinkValue.safeParse(JSON.parse(args.value ?? "")).data;
  } catch {
    parsed = undefined;
  }
  if (!parsed || !slackAgentAllowed(resolved.workspace)) return;
  const { incidentId, from } = parsed;
  const slack = new WebClient(resolved.botToken);
  const tell = (text: string) =>
    slack.chat.postEphemeral({ channel: channelId, user: slackUserId, text });

  const actor = await requireSlackMember({
    workspace: resolved.workspace,
    teamId,
    slackUserId,
    slack,
  });
  if (!actor) {
    await tell(
      "Link your openstatus account first: mention @openstatus to get the link.",
    );
    return;
  }
  const ctx: ServiceContext = { workspace: resolved.workspace, actor };
  const current = await getIncident({ ctx, input: { id: incidentId } });
  if (!current || current.closedAt) {
    await tell(":x: This incident is closed.");
    return;
  }
  if (current.slackChannelId !== from) {
    await tell(
      current.slackChannelId === channelId
        ? "This channel is already the incident channel."
        : ":x: This incident has moved to another channel since.",
    );
    return;
  }
  let moved: Awaited<ReturnType<typeof bindIncidentSlackChannel>>;
  try {
    moved = await bindIncidentSlackChannel({
      ctx,
      input: { id: incidentId, teamId, channelId, expectedChannelId: from },
    });
  } catch (error) {
    await tell(
      error instanceof ServiceError
        ? `:x: ${error.message}`
        : ":x: Could not link this channel. Please try again.",
    );
    return;
  }

  // The move has committed: what follows is cosmetic and must not undo it.
  const url = `${config.dashboardUrl}/incidents/${incidentId}`;
  const header = await slack.chat
    .postMessage({
      channel: channelId,
      text: `Incident: ${moved.title}`,
      blocks: headerBlocks(moved, url),
    })
    .catch((error) => {
      logger.warn("slack relink card failed", { error, incidentId });
      return undefined;
    });
  if (header?.ts) {
    await slack.pins
      .add({ channel: channelId, timestamp: header.ts })
      .catch(() => undefined);
  }
  await slack.chat
    .postMessage({
      channel: from,
      text: `${who(ctx)} moved this incident to <#${channelId}>. This channel is archived.`,
    })
    .catch(() => undefined);
  await slack.conversations
    .archive({ channel: from })
    .catch((error) =>
      logger.warn("slack relink archive failed", { error, incidentId, from }),
    );
  await slack.chat
    .update({
      channel: channelId,
      ts: messageTs,
      text: ":white_check_mark: This channel is now the incident channel.",
      blocks: [],
    })
    .catch(() => undefined);
}
