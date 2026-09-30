import { getLogger } from "@logtape/logtape";
import { ServiceError, type ServiceContext } from "@openstatus/services";
import {
  announceIncidentChange,
  bindIncidentSlackChannel,
  escapeMrkdwn,
  openIncidentSlackChannel,
  type SlackClientFactory,
} from "@openstatus/services/incident";
import { WebClient } from "@slack/web-api";
import { z } from "zod";

import type { SlackConfig } from "./config";
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

/** Slack side effects of an approved incident tool call. Best effort. */
export async function afterIncidentTool(args: {
  ctx: ServiceContext;
  toolName: string;
  input: object;
  output: object;
  config: SlackConfig;
}): Promise<void> {
  const { ctx, toolName, config } = args;
  const output = incidentOutput.safeParse(args.output);
  if (!output.success) return;
  const incidentId = output.data.id;
  try {
    if (toolName === "declare_incident") {
      const result = await openIncidentSlackChannel({
        ctx,
        incidentId,
        clientFor: slackClientFor,
        dashboardUrl: config.dashboardUrl,
      });
      logger.info("slack incident channel", { incidentId, ...result });
      return;
    }
    if (toolName === "resolve_incident" || toolName === "update_incident") {
      const note = incidentInput.safeParse(args.input).data?.note;
      const text =
        toolName === "resolve_incident"
          ? `${who(ctx)} marked the incident *resolved*.${note ? `\n>${escapeMrkdwn(note).replaceAll("\n", "\n>")}` : ""}`
          : `${who(ctx)} updated the incident.`;
      await announceIncidentChange({
        ctx,
        incidentId,
        text,
        clientFor: slackClientFor,
        dashboardUrl: config.dashboardUrl,
      });
    }
  } catch (error) {
    logger.warn("slack incident follow-up failed", { error, incidentId });
  }
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
