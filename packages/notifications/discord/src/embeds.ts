import {
  COLORS,
  type FormattedMessageData,
} from "@openstatus/notification-base";

/**
 * Discord Embed structure for webhook messages
 * Reference: https://birdie0.github.io/discord-webhooks-guide/structure/embeds.html
 */

interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbedFooter {
  text: string;
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: DiscordEmbedField[];
  timestamp: string;
  footer: DiscordEmbedFooter;
  url: string;
}

/**
 * Builds Discord embed for alert notifications
 *
 * Layout:
 * - Title: "{monitor.name} is failing"
 * - Description: "METHOD URL" in code format (e.g., `GET https://api.example.com`)
 * - Color: Red (#ED4245 / 15548997)
 * - Fields: Status Code, Regions, Latency, Cron Timestamp (inline), Error Message in code block (full width)
 * - Timestamp: ISO 8601 format
 * - Footer: "openstatus"
 * - URL: Dashboard link
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns DiscordEmbed object ready for webhook payload
 *
 * @example
 * const embed = buildAlertEmbed({
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
export function buildAlertEmbed(data: FormattedMessageData): DiscordEmbed {
  // Format description as "METHOD URL" or just "URL" for non-HTTP
  const description =
    data.monitorMethod && data.monitorJobType === "http"
      ? `${data.monitorMethod} ${data.monitorUrl}`
      : data.monitorUrl;

  return {
    title: `${data.monitorName} is failing`,
    description: `\`${description}\``,
    color: COLORS.red,
    fields: [
      {
        name: "Status Code",
        value: data.statusCodeFormatted,
        inline: true,
      },
      {
        name: "Regions",
        value: data.regionsDisplay,
        inline: true,
      },
      {
        name: "Latency",
        value: data.latencyDisplay,
        inline: true,
      },
      {
        name: "Cron Timestamp",
        value: data.timestampFormatted,
        inline: true,
      },
      {
        name: "Error Message",
        value: `\`\`\`${data.errorMessage}\`\`\``,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "openstatus",
    },
    url: data.dashboardUrl,
  };
}

/**
 * Builds Discord embed for recovery notifications
 *
 * Layout:
 * - Title: "{monitor.name} is recovered"
 * - Description: "METHOD URL" in code format (e.g., `GET https://api.example.com`)
 * - Color: Green (#57F287 / 5763719)
 * - Fields: Optional Downtime field (if incidentDuration exists), Status Code, Regions, Latency, Cron Timestamp (inline)
 * - Timestamp: ISO 8601 format
 * - Footer: "openstatus"
 * - URL: Dashboard link
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns DiscordEmbed object ready for webhook payload
 *
 * @example
 * const embed = buildRecoveryEmbed({
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
export function buildRecoveryEmbed(data: FormattedMessageData): DiscordEmbed {
  const fields: DiscordEmbedField[] = [];

  // Format description as "METHOD URL" or just "URL" for non-HTTP
  const description =
    data.monitorMethod && data.monitorJobType === "http"
      ? `${data.monitorMethod} ${data.monitorUrl}`
      : data.monitorUrl;

  // Add downtime field if incident duration is available
  if (data.incidentDuration) {
    fields.push({
      name: "⏱️ Downtime",
      value: data.incidentDuration,
      inline: false,
    });
  }

  // Add status fields (inline for 3-column layout)
  fields.push(
    {
      name: "Status Code",
      value: data.statusCodeFormatted,
      inline: true,
    },
    {
      name: "Regions",
      value: data.regionsDisplay,
      inline: true,
    },
    {
      name: "Latency",
      value: data.latencyDisplay,
      inline: true,
    },
    {
      name: "Cron Timestamp",
      value: data.timestampFormatted,
      inline: true,
    },
  );

  return {
    title: `${data.monitorName} is recovered`,
    description: `\`${description}\``,
    color: COLORS.green,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "openstatus",
    },
    url: data.dashboardUrl,
  };
}

/**
 * Builds Discord embed for degraded notifications
 *
 * Layout:
 * - Title: "{monitor.name} is degraded"
 * - Description: "METHOD URL" in code format (e.g., `GET https://api.example.com`)
 * - Color: Yellow (#FEE75C / 16705372)
 * - Fields: Optional Previous Incident Duration field (if incidentDuration exists), Status Code, Regions, Latency, Cron Timestamp (inline)
 * - Timestamp: ISO 8601 format
 * - Footer: "openstatus"
 * - URL: Dashboard link
 *
 * @param data - Formatted message data from buildCommonMessageData
 * @returns DiscordEmbed object ready for webhook payload
 *
 * @example
 * const embed = buildDegradedEmbed({
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
export function buildDegradedEmbed(data: FormattedMessageData): DiscordEmbed {
  const fields: DiscordEmbedField[] = [];

  // Format description as "METHOD URL" or just "URL" for non-HTTP
  const description =
    data.monitorMethod && data.monitorJobType === "http"
      ? `${data.monitorMethod} ${data.monitorUrl}`
      : data.monitorUrl;

  // Add previous incident duration field if available
  if (data.incidentDuration) {
    fields.push({
      name: "⏱️ Previous Incident Duration",
      value: data.incidentDuration,
      inline: false,
    });
  }

  // Add status fields (inline for 3-column layout)
  fields.push(
    {
      name: "Status Code",
      value: data.statusCodeFormatted,
      inline: true,
    },
    {
      name: "Regions",
      value: data.regionsDisplay,
      inline: true,
    },
    {
      name: "Latency",
      value: data.latencyDisplay,
      inline: true,
    },
    {
      name: "Cron Timestamp",
      value: data.timestampFormatted,
      inline: true,
    },
  );

  return {
    title: `${data.monitorName} is degraded`,
    description: `\`${description}\``,
    color: COLORS.yellow,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "openstatus",
    },
    url: data.dashboardUrl,
  };
}
