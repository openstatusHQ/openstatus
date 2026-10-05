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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function incidentLine(i: HomeIncident): KnownBlock {
  const text = [
    `${SEVERITY_EMOJI[i.severity] ?? "•"} *<${i.url}|${escapeMrkdwn(i.title)}>*`,
    capitalize(i.severity),
    capitalize(i.status),
    `#${i.id}`,
    ...(i.slackChannelId ? [`<#${i.slackChannelId}>`] : []),
  ].join("  ·  ");
  return { type: "section", text: { type: "mrkdwn", text } };
}

function incidentBlocks(openIncidents: HomeIncident[]): KnownBlock[] {
  const heading =
    openIncidents.length === 0
      ? "*Open incidents*"
      : `*Open incidents (${openIncidents.length})*`;
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: heading },
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Declare incident", emoji: true },
        style: "danger",
        action_id: OPEN_DECLARE_INCIDENT_ACTION,
      },
    },
    ...(openIncidents.length === 0
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: ":white_check_mark: No open incidents. All quiet.",
            },
          } satisfies KnownBlock,
        ]
      : openIncidents.map(incidentLine)),
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Declaring an incident opens a dedicated channel and adds you to it. You can also use the *Declare incident* shortcut: type `/` in any message box, or pick it from a message's *⋯* menu to start from that message.",
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
  const { items: rows } = await listIncidents({
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
  const commandBlocks: KnownBlock[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Slash commands*" },
    },
    ...(incidents
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                "*Incidents*",
                "`/openstatus incident declare`  Open the declare form",
                "`/openstatus incident list`  List open incidents",
                "`/openstatus incident note <text>`  Add a note to the timeline",
                "`/openstatus incident mitigate` · `resolve` · `cancel` · `reopen`  Change its status",
                "`/openstatus incident postmortem`  Draft the postmortem",
              ].join("\n"),
            },
          } satisfies KnownBlock,
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Run these in the incident's channel, or add its number from anywhere, e.g. `/openstatus incident resolve #12`.",
              },
            ],
          } satisfies KnownBlock,
        ]
      : []),
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*Status page subscriptions*",
          "`/openstatus subscribe <status-page-url>`  Post that page's updates in this channel",
          "`/openstatus unsubscribe <status-page-url>`  Stop posting them",
          "`/openstatus subscriptions`  List this channel's subscriptions",
        ].join("\n"),
      },
    },
  ];
  return [
    ...reconnect,
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: incidents
          ? "*Run incidents and keep your status page up to date, without leaving Slack.*"
          : "*Keep your status page up to date, without leaving Slack.*",
      },
    },
    { type: "divider" },
    ...(incidents ? incidentBlocks(incidents) : []),
    {
      type: "section",
      text: { type: "mrkdwn", text: "*Update your status page*" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          "*1.* Mention *@openstatus* in a channel or thread, or open it from the Slack top bar, and describe what's happening.",
          "*2.* It reads the conversation and drafts a status report.",
          "*3.* Click *Approve* to publish it, or *Approve & Notify* to also notify your subscribers.",
        ].join("\n"),
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: 'Keep replying in the same thread: _"we found the cause"_ moves the report to Identified, _"it\'s fixed"_ to Resolved.',
        },
      ],
    },
    { type: "divider" },
    ...commandBlocks,
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `\`/openstatus help\` lists every command  ·  <${DOCS_URL}|Documentation>`,
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
