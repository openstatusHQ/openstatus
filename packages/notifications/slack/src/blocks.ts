import type { FormattedMessageData } from "@openstatus/notification-base";

/**
 * Slack Block types for rich message formatting
 * Reference: https://docs.slack.dev/messaging/formatting-message-text
 */

interface SlackTextObject {
  type: "plain_text" | "mrkdwn";
  text: string;
  emoji?: boolean;
}

interface SlackHeaderBlock {
  type: "header";
  text: SlackTextObject;
}

interface SlackSectionBlock {
  type: "section";
  text?: SlackTextObject;
  fields?: SlackTextObject[];
  accessory?: SlackButtonElement;
}

interface SlackDividerBlock {
  type: "divider";
}

interface SlackActionsBlock {
  type: "actions";
  elements: SlackButtonElement[];
}

interface SlackButtonElement {
  type: "button";
  text: SlackTextObject;
  url?: string;
  action_id?: string;
}

type SlackBlock =
  | SlackHeaderBlock
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackActionsBlock;

/**
 * Escapes special characters for Slack mrkdwn format
 * Reference: https://api.slack.com/reference/surfaces/formatting#escaping
 *
 * @param text - Text to escape
 * @returns Escaped text safe for Slack mrkdwn
 *
 * @example
 * escapeSlackText("Hello & <world>") // "Hello &amp; &lt;world&gt;"
 */
export function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Builds Slack blocks for alert notifications
 *
 * Layout:
 * - Header: "🔴 Monitor Down"
 * - Section: Monitor name as clickable link
 * - Divider
 * - Section: 4 fields in 2x2 grid (Status, Region, Latency, Time)
 * - Section: Error message in code block
 * - Actions: Dashboard button
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns Array of Slack blocks
 *
 * @example
 * const blocks = buildAlertBlocks({
 *   monitorName: "API Health",
 *   monitorUrl: "https://api.example.com",
 *   statusCodeFormatted: "503 Service Unavailable",
 *   errorMessage: "Connection timeout",
 *   timestampFormatted: "Jan 22, 2026 at 14:30 UTC",
 *   regionDisplay: "iad (Virginia)",
 *   latencyDisplay: "1,234 ms",
 *   dashboardUrl: "https://app.openstatus.dev/monitors/123"
 * });
 */
export function buildAlertBlocks(data: FormattedMessageData): SlackBlock[] {
  const escapedName = escapeSlackText(data.monitorName);
  const escapedError = escapeSlackText(data.errorMessage);

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🔴 Monitor Down",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${data.monitorUrl}|${escapedName}>*`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Status*\n${data.statusCodeFormatted}`,
        },
        {
          type: "mrkdwn",
          text: `*Region*\n${data.regionDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Latency*\n${data.latencyDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Time*\n${data.timestampFormatted}`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Error*\n\`\`\`${escapedError}\`\`\``,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Dashboard",
            emoji: true,
          },
          url: data.dashboardUrl,
          action_id: "view_dashboard",
        },
      ],
    },
  ];
}

/**
 * Builds Slack blocks for recovery notifications
 *
 * Layout:
 * - Header: "✅ Monitor Recovered"
 * - Section: Monitor name as clickable link
 * - Section: Downtime duration (optional, only if data.incidentDuration exists)
 * - Divider
 * - Section: 4 fields in 2x2 grid (Status, Region, Latency, Time)
 * - Actions: Dashboard button
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns Array of Slack blocks
 *
 * @example
 * const blocks = buildRecoveryBlocks({
 *   monitorName: "API Health",
 *   monitorUrl: "https://api.example.com",
 *   statusCodeFormatted: "200 OK",
 *   errorMessage: "",
 *   timestampFormatted: "Jan 22, 2026 at 14:35 UTC",
 *   regionDisplay: "iad (Virginia)",
 *   latencyDisplay: "156 ms",
 *   dashboardUrl: "https://app.openstatus.dev/monitors/123",
 *   incidentDuration: "5m 30s"
 * });
 */
export function buildRecoveryBlocks(data: FormattedMessageData): SlackBlock[] {
  const escapedName = escapeSlackText(data.monitorName);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "✅ Monitor Recovered",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${data.monitorUrl}|${escapedName}>*`,
      },
    },
  ];

  // Only include downtime if incident duration is available
  if (data.incidentDuration) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⏱️ *Downtime:* ${data.incidentDuration}`,
      },
    });
  }

  blocks.push(
    {
      type: "divider",
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Status*\n${data.statusCodeFormatted}`,
        },
        {
          type: "mrkdwn",
          text: `*Region*\n${data.regionDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Latency*\n${data.latencyDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Time*\n${data.timestampFormatted}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Dashboard",
            emoji: true,
          },
          url: data.dashboardUrl,
          action_id: "view_dashboard",
        },
      ],
    },
  );

  return blocks;
}

/**
 * Builds Slack blocks for degraded notifications
 *
 * Layout:
 * - Header: "⚠️ Monitor Degraded"
 * - Section: Monitor name as clickable link
 * - Section: Previous incident duration (optional, only if data.incidentDuration exists)
 * - Divider
 * - Section: 4 fields in 2x2 grid (Status, Region, Latency, Time)
 * - Actions: Dashboard button
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns Array of Slack blocks
 *
 * @example
 * const blocks = buildDegradedBlocks({
 *   monitorName: "API Health",
 *   monitorUrl: "https://api.example.com",
 *   statusCodeFormatted: "504 Gateway Timeout",
 *   errorMessage: "Slow response",
 *   timestampFormatted: "Jan 22, 2026 at 14:40 UTC",
 *   regionDisplay: "iad (Virginia)",
 *   latencyDisplay: "5,234 ms",
 *   dashboardUrl: "https://app.openstatus.dev/monitors/123",
 *   incidentDuration: "2h 15m"
 * });
 */
export function buildDegradedBlocks(data: FormattedMessageData): SlackBlock[] {
  const escapedName = escapeSlackText(data.monitorName);

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "⚠️ Monitor Degraded",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${data.monitorUrl}|${escapedName}>*`,
      },
    },
  ];

  // Only include previous incident duration if available
  if (data.incidentDuration) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⏱️ *Previous Incident Duration:* ${data.incidentDuration}`,
      },
    });
  }

  blocks.push(
    {
      type: "divider",
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Status*\n${data.statusCodeFormatted}`,
        },
        {
          type: "mrkdwn",
          text: `*Region*\n${data.regionDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Latency*\n${data.latencyDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Time*\n${data.timestampFormatted}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View Dashboard",
            emoji: true,
          },
          url: data.dashboardUrl,
          action_id: "view_dashboard",
        },
      ],
    },
  );

  return blocks;
}
