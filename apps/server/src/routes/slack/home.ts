import { isFeatureEnabled, type ServiceContext } from "@openstatus/services";
import { escapeMrkdwn, listIncidents } from "@openstatus/services/incident";
import type { WebClient } from "@slack/web-api";
import type { KnownBlock } from "@slack/web-api";

import { buildLinkAccountBlocks } from "./blocks";
import { getIncidentDashboardUrl } from "./page-urls";

export const DOCS_URL = "https://www.openstatus.dev/docs";

export const OPEN_DECLARE_INCIDENT_ACTION = "open_declare_incident";

export type HomeIncident = {
  id: number;
  title: string;
  severity: string;
  status: string;
  url: string;
  slackChannelId: string | null;
};

const SEVERITY_EMOJI: Record<string, string> = {
  critical: ":red_circle:",
  major: ":large_orange_circle:",
  minor: ":large_yellow_circle:",
};

function incidentBlocks(openIncidents: HomeIncident[]): KnownBlock[] {
  const list =
    openIncidents.length === 0
      ? "_No open incidents._ :white_check_mark:"
      : openIncidents
          .map(
            (i) =>
              `${SEVERITY_EMOJI[i.severity] ?? "•"} <${i.url}|${escapeMrkdwn(i.title)}> · ${i.severity} · ${i.status}${i.slackChannelId ? ` · <#${i.slackChannelId}>` : ""}`,
          )
          .join("\n");
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Incidents*" },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Declare incident", emoji: true },
        style: "danger",
        action_id: OPEN_DECLARE_INCIDENT_ACTION,
      },
    },
    { type: "section", text: { type: "mrkdwn", text: list } },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Declaring opens a dedicated channel and invites the team. Also from the *Declare incident* shortcut (type `/`), or a message's *⋯* menu.",
        },
      ],
    },
    { type: "divider" },
  ];
}

/** `undefined` hides the incidents section: the feature is off here. */
export async function homeIncidents(
  ctx: ServiceContext,
): Promise<HomeIncident[] | undefined> {
  if (!isFeatureEnabled(ctx.workspace, "incident-management")) return;
  const rows = await listIncidents({
    ctx,
    input: { status: ["open", "mitigated"], limit: 10 },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    severity: row.severity,
    status: row.status,
    url: getIncidentDashboardUrl(row.id),
    slackChannelId: row.slackChannelId,
  }));
}

export function buildHomeBlocks(
  opts: { reconnectUrl?: string; openIncidents?: HomeIncident[] } = {},
): KnownBlock[] {
  const reconnect: KnownBlock[] = opts.reconnectUrl
    ? [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:warning: *Reconnect openstatus to enable incident channels.* This install is missing permissions openstatus needs to open a channel per incident. <${opts.reconnectUrl}|Reconnect from the dashboard>.`,
          },
        },
        { type: "divider" },
      ]
    : [];
  const incidents = opts.openIncidents;
  const commands = [
    ...(incidents
      ? [
          "• `/openstatus incident declare` — open the declare form",
          "• `/openstatus incident note <text>` — add to the timeline (in an incident channel)",
          "• `/openstatus incident mitigate|resolve|cancel|reopen [#id]` — change its status",
          "• `/openstatus incident postmortem [#id]` — draft the postmortem",
          "• `/openstatus incident list` — open incidents",
        ]
      : []),
    "• `/openstatus subscribe <status-page-url>` — subscribe this channel to a status page",
    "• `/openstatus unsubscribe <status-page-url>` — unsubscribe this channel",
    "• `/openstatus subscriptions` — list this channel's subscriptions",
    "• `/openstatus help` — show all commands",
  ];
  return [
    ...reconnect,
    {
      type: "header",
      text: { type: "plain_text", text: "openstatus", emoji: true },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Your incident communication agent. Open *openstatus* from the Slack top bar to chat with it, or mention *@openstatus* in any channel or thread — it drafts status updates from the conversation, and nothing is published until you approve it.",
      },
    },
    { type: "divider" },
    ...(incidents ? incidentBlocks(incidents) : []),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: '*Status page updates*\nDescribe the issue in the agent pane, or mention `@openstatus` in any channel or thread. It reads the thread, drafts a report, and you click *Approve*, *Approve & Notify*, or *Cancel*. Say _"we found the cause"_ or _"it\'s fixed"_ and it moves the report to Identified or Resolved.',
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Slash commands*\n${commands.join("\n")}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `<${DOCS_URL}|Documentation> · Updates from subscribed status pages appear as threaded messages in the channel.`,
        },
      ],
    },
  ];
}

export async function publishHomeView(
  slack: WebClient,
  userId: string,
  opts: { reconnectUrl?: string; openIncidents?: HomeIncident[] } = {},
): Promise<void> {
  await slack.views.publish({
    user_id: userId,
    view: { type: "home", blocks: buildHomeBlocks(opts) },
  });
}

export async function publishLinkAccountView(
  slack: WebClient,
  userId: string,
  url: string,
): Promise<void> {
  await slack.views.publish({
    user_id: userId,
    view: { type: "home", blocks: buildLinkAccountBlocks(url) },
  });
}
