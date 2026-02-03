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
 * - Header: "{monitor.name} is failing"
 * - Section: "METHOD URL" in code format (e.g., `GET https://api.example.com`)
 * - Divider
 * - Section: 4 fields in 2x2 grid (Status, Regions, Latency, Cron Timestamp)
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
 *   monitorMethod: "GET",
 *   monitorJobType: "http",
 *   statusCodeFormatted: "503 Service Unavailable",
 *   errorMessage: "Connection timeout",
 *   timestampFormatted: "Jan 22, 2026 at 14:30 UTC",
 *   regionsDisplay: "iad, fra, syd",
 *   latencyDisplay: "1,234 ms",
 *   dashboardUrl: "https://app.openstatus.dev/monitors/123"
 * });
 */
export function buildAlertBlocks(data: FormattedMessageData): SlackBlock[] {
  const escapedName = escapeSlackText(data.monitorName);
  const escapedError = escapeSlackText(data.errorMessage);

  // Format description as "METHOD URL" or just "URL" for non-HTTP
  const description =
    data.monitorMethod && data.monitorJobType === "http"
      ? `${data.monitorMethod} <${data.monitorUrl}|${data.monitorUrl}>`
      : `<${data.monitorUrl}|${data.monitorUrl}>`;

  return [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${escapedName} is failing`,
        emoji: false,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`${description}\``,
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
          text: `*Regions*\n${data.regionsDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Latency*\n${data.latencyDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Cron Timestamp*\n${data.timestampFormatted}`,
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
 * - Header: "{monitor.name} is recovered"
 * - Section: "METHOD URL" in code format (e.g., `GET https://api.example.com`)
 * - Section: Downtime duration (optional, only if data.incidentDuration exists)
 * - Divider
 * - Section: 4 fields in 2x2 grid (Status, Regions, Latency, Cron Timestamp)
 * - Actions: Dashboard button
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns Array of Slack blocks
 *
 * @example
 * const blocks = buildRecoveryBlocks({
 *   monitorName: "API Health",
 *   monitorUrl: "https://api.example.com",
 *   monitorMethod: "GET",
 *   monitorJobType: "http",
 *   statusCodeFormatted: "200 OK",
 *   errorMessage: "",
 *   timestampFormatted: "Jan 22, 2026 at 14:35 UTC",
 *   regionsDisplay: "iad, fra, syd",
 *   latencyDisplay: "156 ms",
 *   dashboardUrl: "https://app.openstatus.dev/monitors/123",
 *   incidentDuration: "5m 30s"
 * });
 */
export function buildRecoveryBlocks(data: FormattedMessageData): SlackBlock[] {
  const escapedName = escapeSlackText(data.monitorName);

  // Format description as "METHOD URL" or just "URL" for non-HTTP
  const description =
    data.monitorMethod && data.monitorJobType === "http"
      ? `${data.monitorMethod} <${data.monitorUrl}|${data.monitorUrl}>`
      : `<${data.monitorUrl}|${data.monitorUrl}>`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${escapedName} is recovered :joy:`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`${description}\``,
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
          text: `*Regions*\n${data.regionsDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Latency*\n${data.latencyDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Cron Timestamp*\n${data.timestampFormatted}`,
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
 * - Header: "{monitor.name} is degraded"
 * - Section: "METHOD URL" in code format (e.g., `GET https://api.example.com`)
 * - Section: Previous incident duration (optional, only if data.incidentDuration exists)
 * - Divider
 * - Section: 4 fields in 2x2 grid (Status, Regions, Latency, Cron Timestamp)
 * - Actions: Dashboard button
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns Array of Slack blocks
 *
 * @example
 * const blocks = buildDegradedBlocks({
 *   monitorName: "API Health",
 *   monitorUrl: "https://api.example.com",
 *   monitorMethod: "GET",
 *   monitorJobType: "http",
 *   statusCodeFormatted: "504 Gateway Timeout",
 *   errorMessage: "Slow response",
 *   timestampFormatted: "Jan 22, 2026 at 14:40 UTC",
 *   regionsDisplay: "iad, fra, syd",
 *   latencyDisplay: "5,234 ms",
 *   dashboardUrl: "https://app.openstatus.dev/monitors/123",
 *   incidentDuration: "2h 15m"
 * });
 */
export function buildDegradedBlocks(data: FormattedMessageData): SlackBlock[] {
  const escapedName = escapeSlackText(data.monitorName);

  // Format description as "METHOD URL" or just "URL" for non-HTTP
  const description =
    data.monitorMethod && data.monitorJobType === "http"
      ? `${data.monitorMethod} <${data.monitorUrl}|${data.monitorUrl}>`
      : `<${data.monitorUrl}|${data.monitorUrl}>`;

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${escapedName} is degraded`,
        emoji: false,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `\`${description}\``,
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
          text: `*Regions*\n${data.regionsDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Latency*\n${data.latencyDisplay}`,
        },
        {
          type: "mrkdwn",
          text: `*Cron Timestamp*\n${data.timestampFormatted}`,
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
