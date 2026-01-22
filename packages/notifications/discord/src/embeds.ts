import type { FormattedMessageData } from "@openstatus/notification-base";

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
 * Discord embed colors (decimal values)
 * Red: #ED4245 = 15548997
 * Green: #57F287 = 5763719
 * Yellow: #FEE75C = 16705372
 */
const COLORS = {
  red: 15548997,
  green: 5763719,
  yellow: 16705372,
} as const;

/**
 * Builds Discord embed for alert notifications
 *
 * Layout:
 * - Title: "🔴 Monitor Down"
 * - Description: Monitor name as markdown link
 * - Color: Red (#ED4245 / 15548997)
 * - Fields: Status Code, Region, Latency (inline), Error Message (full width)
 * - Timestamp: ISO 8601 format
 * - Footer: "OpenStatus"
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
  return {
    title: "🔴 Monitor Down",
    description: `**[${data.monitorName}](${data.monitorUrl})**`,
    color: COLORS.red,
    fields: [
      {
        name: "Status Code",
        value: data.statusCodeFormatted,
        inline: true,
      },
      {
        name: "Region",
        value: data.regionDisplay,
        inline: true,
      },
      {
        name: "Latency",
        value: data.latencyDisplay,
        inline: true,
      },
      {
        name: "Error Message",
        value: data.errorMessage || "_No error message_",
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: "OpenStatus",
    },
    url: data.dashboardUrl,
  };
}

/**
 * Builds Discord embed for recovery notifications
 *
 * Layout:
 * - Title: "✅ Monitor Recovered"
 * - Description: Monitor name as markdown link
 * - Color: Green (#57F287 / 5763719)
 * - Fields: Optional Downtime field (if incidentDuration exists), Status Code, Region, Latency (inline)
 * - Timestamp: ISO 8601 format
 * - Footer: "OpenStatus"
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
      name: "Region",
      value: data.regionDisplay,
      inline: true,
    },
    {
      name: "Latency",
      value: data.latencyDisplay,
      inline: true,
    },
  );

  return {
    title: "✅ Monitor Recovered",
    description: `**[${data.monitorName}](${data.monitorUrl})**`,
    color: COLORS.green,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "OpenStatus",
    },
    url: data.dashboardUrl,
  };
}

/**
 * Builds Discord embed for degraded notifications
 *
 * Layout:
 * - Title: "⚠️ Monitor Degraded"
 * - Description: Monitor name as markdown link
 * - Color: Yellow (#FEE75C / 16705372)
 * - Fields: Optional Previous Incident Duration field (if incidentDuration exists), Status Code, Region, Latency (inline)
 * - Timestamp: ISO 8601 format
 * - Footer: "OpenStatus"
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
      name: "Region",
      value: data.regionDisplay,
      inline: true,
    },
    {
      name: "Latency",
      value: data.latencyDisplay,
      inline: true,
    },
  );

  return {
    title: "⚠️ Monitor Degraded",
    description: `**[${data.monitorName}](${data.monitorUrl})**`,
    color: COLORS.yellow,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "OpenStatus",
    },
    url: data.dashboardUrl,
  };
}
