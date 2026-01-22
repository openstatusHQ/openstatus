import type { Incident } from "@openstatus/db/src/schema";
import { getRegionInfo } from "@openstatus/regions";
import type { FormattedMessageData, NotificationContext } from "../types";
import { getIncidentDuration } from "./incident";
import { formatTimestamp } from "./timestamp";

/**
 * Common HTTP status descriptions
 */
const statusDescriptions: Record<number, string> = {
  200: "OK",
  201: "Created",
  204: "No Content",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

/**
 * Format status code for display with human-readable description
 *
 * @example
 * formatStatusCode(503) // "503 Service Unavailable"
 * formatStatusCode(404) // "404 Not Found"
 * formatStatusCode(418) // "418" (no description available)
 * formatStatusCode(undefined) // "Unknown"
 *
 * @param statusCode - HTTP status code
 * @returns Formatted status code string
 */
export function formatStatusCode(statusCode?: number): string {
  if (!statusCode) {
    return "Unknown";
  }

  const description = statusDescriptions[statusCode];
  return description ? `${statusCode} ${description}` : `${statusCode}`;
}

/**
 * Build common formatted message data from notification context
 *
 * Centralizes formatting logic used by all providers to ensure consistency.
 *
 * @example
 * const data = buildCommonMessageData(context);
 * // Returns: {
 * //   monitorName: "My API",
 * //   monitorUrl: "https://api.example.com",
 * //   statusCodeFormatted: "503 Service Unavailable",
 * //   errorMessage: "Connection timeout",
 * //   timestampFormatted: "Jan 22, 2026 at 14:30 UTC",
 * //   regionDisplay: "ams (Amsterdam, Netherlands)",
 * //   latencyDisplay: "2,450ms",
 * //   dashboardUrl: "https://app.openstatus.dev/monitors/123",
 * //   incidentDuration: undefined
 * // }
 *
 * @param context - Notification context with monitor and event data
 * @param options - Optional configuration
 * @param options.incident - Include incident data for duration calculation
 * @returns Formatted message data ready for rendering
 */
export function buildCommonMessageData(
  context: NotificationContext,
  options?: {
    incident?: Incident;
  },
): FormattedMessageData {
  const { monitor, statusCode, message, cronTimestamp, region, latency } =
    context;

  // Get region info with location name
  const regionInfo = region ? getRegionInfo(region) : null;
  const regionDisplay = regionInfo
    ? `${regionInfo.code} (${regionInfo.location})`
    : "Unknown";

  // Calculate incident duration only if incident is resolved
  let incidentDuration: string | undefined;
  if (options?.incident?.resolvedAt) {
    const duration = getIncidentDuration(options.incident);
    incidentDuration = duration ?? undefined;
  }

  return {
    monitorName: monitor.name,
    monitorUrl: monitor.url,
    statusCodeFormatted: formatStatusCode(statusCode),
    errorMessage: message || "No error message available",
    timestampFormatted: formatTimestamp(cronTimestamp),
    regionDisplay,
    latencyDisplay: latency ? `${latency.toLocaleString()}ms` : "N/A",
    dashboardUrl: `https://app.openstatus.dev/monitors/${monitor.id}`,
    incidentDuration,
  };
}
