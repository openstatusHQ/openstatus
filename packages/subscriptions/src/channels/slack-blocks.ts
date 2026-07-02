import { COLORS } from "@openstatus/notification-base";
import type { KnownBlock, MessageAttachment } from "@slack/web-api";

import type { PageUpdate, Subscription } from "../types";

type StatusColor = "red" | "yellow" | "green" | "blue";

const STATUS_EMOJI: Record<PageUpdate["status"], string> = {
  investigating: "🔍",
  identified: "🔴",
  monitoring: "👀",
  resolved: "✅",
  maintenance: "🔧",
};

const STATUS_LABEL: Record<PageUpdate["status"], string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  maintenance: "Maintenance",
};

function statusColor(status: PageUpdate["status"]): StatusColor {
  switch (status) {
    case "investigating":
    case "identified":
      return "red";
    case "monitoring":
      return "yellow";
    case "resolved":
      return "green";
    case "maintenance":
      return "blue";
  }
}

function pageOrigin(subscription: Subscription): string {
  return subscription.customDomain
    ? `https://${subscription.customDomain}`
    : `https://${subscription.pageSlug}.openstatus.dev`;
}

function eventUrl(pageUpdate: PageUpdate, subscription: Subscription): string {
  const kind = pageUpdate.status === "maintenance" ? "maintenance" : "report";
  return `${pageOrigin(subscription)}/events/${kind}/${pageUpdate.id}`;
}

export interface SlackRootMessage {
  text: string;
  attachments: MessageAttachment[];
}

export interface SlackReplyMessage {
  text: string;
  blocks: KnownBlock[];
}

export function buildRootMessage(
  pageUpdate: PageUpdate,
  subscription: Subscription,
): SlackRootMessage {
  const emoji = STATUS_EMOJI[pageUpdate.status];
  const label = STATUS_LABEL[pageUpdate.status];
  const origin = pageOrigin(subscription);

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} ${pageUpdate.title} — ${label}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Status*\n${label}` },
        {
          type: "mrkdwn",
          text: `*Page*\n<${origin}|${subscription.pageName}>`,
        },
      ],
    },
  ];

  if (pageUpdate.message) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: pageUpdate.message },
    });
  }

  if (pageUpdate.pageComponents.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Affected*\n${pageUpdate.pageComponents.join(", ")}`,
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `Updated ${pageUpdate.date} · <${eventUrl(pageUpdate, subscription)}|View details> · Manage with \`/openstatus remove\``,
      },
    ],
  });

  return {
    text: `${emoji} ${pageUpdate.title} — ${label}`,
    attachments: [{ color: COLORS[statusColor(pageUpdate.status)], blocks }],
  };
}

export function buildReplyMessage(pageUpdate: PageUpdate): SlackReplyMessage {
  const emoji = STATUS_EMOJI[pageUpdate.status];
  const label = STATUS_LABEL[pageUpdate.status];
  const heading = `${emoji} *${label}* · ${pageUpdate.date}`;

  return {
    text: pageUpdate.message ? `${label}: ${pageUpdate.message}` : label,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: pageUpdate.message
            ? `${heading}\n${pageUpdate.message}`
            : heading,
        },
      },
    ],
  };
}
