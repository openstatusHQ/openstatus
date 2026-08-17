import { COLORS } from "@openstatus/notification-base";
import { statusLabel } from "@openstatus/utils";
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
  const label = statusLabel(pageUpdate.status);
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
        text: `Updated ${pageUpdate.date} · <${eventUrl(pageUpdate, subscription)}|View details> · Manage with \`/openstatus unsubscribe\``,
      },
    ],
  });

  const title = `${emoji} ${pageUpdate.title} — ${label}`;
  return {
    // `text` is the notification/accessibility fallback only — it is NOT sent
    // as the message body, otherwise the title renders twice (once here, once
    // in the card's header block). See the root post/update calls in slack.ts.
    text: title,
    attachments: [
      {
        color: COLORS[statusColor(pageUpdate.status)],
        fallback: title,
        blocks,
      },
    ],
  };
}

export function buildReplyMessage(pageUpdate: PageUpdate): SlackReplyMessage {
  const emoji = STATUS_EMOJI[pageUpdate.status];
  const label = statusLabel(pageUpdate.status);
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
