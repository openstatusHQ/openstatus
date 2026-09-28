import { getLogger } from "@logtape/logtape";
import {
  type IncidentStatus,
  isFeatureEnabled,
  type ServiceContext,
  ServiceError,
} from "@openstatus/services";
import {
  addIncidentNote,
  displayName,
  generatePostmortemDraft,
  getIncident,
  getIncidentBySlackChannel,
  listIncidents,
} from "@openstatus/services/incident";
import { WebClient } from "@slack/web-api";

import type { SlackConfig } from "./config";
import { postConfirmationCard } from "./confirmation-card";
import { trackSlackIncident } from "./incident-analytics";
import { getIncidentDashboardUrl } from "./page-urls";
import { generateWithSlackModel } from "./postmortem-generator";
import type { SlackActor } from "./require-slack-member";
import type { SlackWorkspace } from "./workspace-resolver";

const logger = getLogger(["api-server", "slack", "incident-commands"]);

export const INCIDENT_HELP = [
  "*Incidents*",
  "• `/openstatus incident declare <title> [--sev critical|major|minor]` — declare an incident (approval card)",
  "• `/openstatus incident note <text>` — add to the timeline (in an incident channel)",
  "• `/openstatus incident mitigate|resolve|cancel|reopen [#id] [note]` — change its status (approval card)",
  "• `/openstatus incident status [#id]` — where it stands",
  "• `/openstatus incident postmortem [#id]` — draft the postmortem from the channel (approval card to approve and close)",
  "• `/openstatus incident list` — open incidents",
].join("\n");

const SEVERITIES = ["critical", "major", "minor"] as const;
type Severity = (typeof SEVERITIES)[number];

const STATUS_BY_VERB: Record<string, IncidentStatus> = {
  mitigate: "mitigated",
  resolve: "resolved",
  cancel: "canceled",
  reopen: "open",
};

/** `declare API down --sev critical` → title and severity, flag anywhere. */
export function parseDeclare(words: string[]): {
  title: string;
  severity: Severity;
} {
  let severity: Severity = "major";
  const title: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word === "--sev" || word === "--severity") {
      const value = SEVERITIES.find((s) => s === words[i + 1]?.toLowerCase());
      if (value) severity = value;
      i++;
      continue;
    }
    title.push(word);
  }
  return { title: title.join(" ").trim(), severity };
}

/** A leading `#12` or `12` names the incident; the rest is the note. */
export function parseTarget(words: string[]): {
  id: number | null;
  rest: string;
} {
  const match = words[0]?.match(/^#?(\d+)$/);
  if (!match) return { id: null, rest: words.join(" ").trim() };
  return { id: Number(match[1]), rest: words.slice(1).join(" ").trim() };
}

async function postCard(args: {
  slack: WebClient;
  ctx: ServiceContext;
  teamId: string;
  channelId: string;
  slackUserId: string;
  toolName: string;
  input: object;
}): Promise<string> {
  try {
    await postConfirmationCard({
      ...args,
      channel: args.channelId,
    });
    return "Review the approval card in this channel.";
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("not_in_channel")
    ) {
      throw error;
    }
    try {
      await args.slack.conversations.join({ channel: args.channelId });
      await postConfirmationCard({ ...args, channel: args.channelId });
      return "Review the approval card in this channel.";
    } catch {
      return "Invite @openstatus to this channel first (`/invite @openstatus`), then try again.";
    }
  }
}

export async function runIncidentCommand(args: {
  words: string[];
  teamId: string;
  channelId: string;
  resolved: SlackWorkspace;
  actor: SlackActor;
  config: SlackConfig;
}): Promise<string> {
  const { words, teamId, channelId, resolved, actor } = args;
  const ctx: ServiceContext = { workspace: resolved.workspace, actor };
  if (!isFeatureEnabled(resolved.workspace, "incident-management")) {
    return "Incident management isn't available for this workspace yet.";
  }
  const slack = new WebClient(resolved.botToken);
  const [verb = "help", ...rest] = words;
  const bound = await getIncidentBySlackChannel({
    ctx,
    input: { teamId, channelId },
  });

  try {
    switch (verb.toLowerCase()) {
      case "declare": {
        const { title, severity } = parseDeclare(rest);
        if (!title) {
          return "Usage: `/openstatus incident declare <title> [--sev critical|major|minor]`";
        }
        return postCard({
          slack,
          ctx,
          teamId,
          channelId,
          slackUserId: actor.slackUserId,
          toolName: "declare_incident",
          input: { title, severity },
        });
      }
      case "note": {
        const message = rest.join(" ").trim();
        if (!bound) {
          return "Run `note` in an incident's channel, or mention @openstatus and say which incident.";
        }
        if (!message) return "Usage: `/openstatus incident note <text>`";
        await addIncidentNote({ ctx, input: { id: bound.id, message } });
        trackSlackIncident(ctx, "note");
        return `Added to the timeline of *${bound.title}*.`;
      }
      case "mitigate":
      case "resolve":
      case "cancel":
      case "reopen": {
        const { id, rest: note } = parseTarget(rest);
        const incidentId = id ?? bound?.id;
        if (!incidentId) {
          return `Run this in an incident's channel, or name it: \`/openstatus incident ${verb} #12\`.`;
        }
        return postCard({
          slack,
          ctx,
          teamId,
          channelId,
          slackUserId: actor.slackUserId,
          toolName: "set_incident_status",
          input: {
            id: incidentId,
            status: STATUS_BY_VERB[verb.toLowerCase()],
            ...(note ? { note } : {}),
          },
        });
      }
      case "postmortem": {
        const { id } = parseTarget(rest);
        const incidentId = id ?? bound?.id;
        if (!incidentId) {
          return "Run this in an incident's channel, or name it: `/openstatus incident postmortem #12`.";
        }
        await generatePostmortemDraft({
          ctx,
          incidentId,
          generate: generateWithSlackModel,
          slackFor: (token) => new WebClient(token),
        });
        trackSlackIncident(ctx, "postmortem", { draftedBy: "agent" });
        const card = await postCard({
          slack,
          ctx,
          teamId,
          channelId,
          slackUserId: actor.slackUserId,
          toolName: "approve_postmortem",
          input: { id: incidentId, close: true },
        });
        return `Postmortem drafted: <${getIncidentDashboardUrl(incidentId)}|read and edit it in openstatus>. ${card}`;
      }
      case "status": {
        const { id } = parseTarget(rest);
        const target =
          id !== null ? await getIncident({ ctx, input: { id } }) : bound;
        if (!target) {
          return "No incident here. Name one: `/openstatus incident status #12`.";
        }
        const commander = target.commander
          ? displayName(target.commander)
          : "none";
        return `*${target.title}* · ${target.severity} · ${target.status}${target.closedAt ? " (closed)" : ""}\nCommander: ${commander}${target.statusReport ? `\nStatus report: ${target.statusReport.title} (${target.statusReport.status})` : ""}\n<${getIncidentDashboardUrl(target.id)}|Open in openstatus>`;
      }
      case "list": {
        const open = await listIncidents({
          ctx,
          input: { status: ["open", "mitigated"], limit: 20 },
        });
        if (open.length === 0) return "No open incidents.";
        return open
          .map(
            (i) =>
              `• #${i.id} <${getIncidentDashboardUrl(i.id)}|${i.title}> · ${i.severity} · ${i.status}`,
          )
          .join("\n");
      }
      default:
        return INCIDENT_HELP;
    }
  } catch (error) {
    if (error instanceof ServiceError) return `:x: ${error.message}`;
    logger.error("slack incident command failed", { error, verb });
    return ":x: Something went wrong. Please try again.";
  }
}
