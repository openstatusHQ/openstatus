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
 * //   monitorMethod: "GET",
 * //   monitorJobType: "http",
 * //   statusCodeFormatted: "503 Service Unavailable",
 * //   errorMessage: "Connection timeout",
 * //   timestampFormatted: "Jan 22, 2026 at 14:30 UTC",
 * //   regionsDisplay: "ams, fra, syd",
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
  const { monitor, statusCode, message, cronTimestamp, regions, latency } =
    context;

  // Format multiple regions as comma-separated list
  let regionsDisplay = "Unknown";
  if (regions && regions.length > 0) {
    if (regions.length === 1) {
      // Single region: show code and location
      const regionInfo = getRegionInfo(regions[0]);
      regionsDisplay = regionInfo
        ? `${regionInfo.code} (${regionInfo.location})`
        : regions[0];
    } else {
      // Multiple regions: show comma-separated codes
      regionsDisplay = regions.join(", ");
    }
  }

  // Calculate incident duration only if incident is resolved
  let incidentDuration: string | undefined;
  if (options?.incident?.resolvedAt) {
    const duration = getIncidentDuration(options.incident);
    incidentDuration = duration ?? undefined;
  }

  return {
    monitorName: monitor.name,
    monitorUrl: monitor.url,
    monitorMethod: monitor.method ?? undefined,
    monitorJobType: monitor.jobType,
    statusCodeFormatted: formatStatusCode(statusCode),
    errorMessage: message || "No error message available",
    timestampFormatted: formatTimestamp(cronTimestamp),
    regionsDisplay,
    latencyDisplay:
      typeof latency === "number" ? `${latency.toLocaleString()}ms` : "N/A",
    dashboardUrl: `https://app.openstatus.dev/monitors/${monitor.id}`,
    incidentDuration,
  };
}
