import type { SeverityLevel, StatusType } from "./types";

/**
 * Check if a URL's hostname equals or is a subdomain of the given domain.
 * Uses proper hostname parsing to prevent substring spoofing attacks
 * (e.g. "evil.com/statuspage.io" or "statuspage.io.evil.com").
 */
export function urlHostnameEndsWith(url: string, domain: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

/**
 * Infer normalized status type from free-text description and severity level
 *
 * This function maps diverse status messages from different providers into a
 * standardized set of status types. It uses keyword matching with priority ordering
 * to ensure consistent classification.
 *
 * **Detection Priority** (highest to lowest):
 * 1. **Incident workflow** - investigating, identified, monitoring, resolved
 * 2. **Maintenance** - scheduled or emergency maintenance
 * 3. **Specific outages** - major outage, partial outage
 * 4. **General down state** - with word boundary detection to avoid false matches
 * 5. **Degraded performance** - degraded, performance issues
 * 6. **Severity fallback** - when no keywords match, use severity level
 *
 * @param description - Free-text status description (e.g., "Investigating database issues")
 * @param severity - Impact level: none, minor, major, or critical
 * @returns Normalized status type
 *
 * @example
 * ```typescript
 * inferStatus("Investigating API errors", "major")
 * // => "investigating"
 *
 * inferStatus("Service degraded", "minor")
 * // => "degraded"
 *
 * inferStatus("All Systems Operational", "none")
 * // => "operational"
 *
 * inferStatus("Scheduled maintenance in progress", "none")
 * // => "under_maintenance"
 * ```
 */
export function inferStatus(
  description: string,
  severity: SeverityLevel,
): StatusType {
  const lower = description.toLowerCase();

  // Incident workflow states (highest priority - specific states)
  if (lower.includes("investigating")) return "investigating";
  if (lower.includes("identified")) return "identified";
  if (lower.includes("monitoring")) return "monitoring";
  if (lower.includes("resolved")) return "resolved";

  // Maintenance (high priority - planned work)
  if (lower.includes("maintenance")) return "under_maintenance";

  // Specific outage types (check specific before general)
  if (lower.includes("major outage") || lower.includes("complete outage")) {
    return "major_outage";
  }
  if (lower.includes("partial outage") || lower.includes("partial system")) {
    return "partial_outage";
  }

  // General down state (use word boundaries to avoid false matches)
  // Matches: "is down", "are down", "service down", but not "countdown"
  if (/\b(is|are|service|system|services|systems)\s+down\b/.test(lower)) {
    return "major_outage";
  }
  // Also match standalone "down" at end of sentence or after punctuation
  if (/(\s|^)down(\s|[.,!?]|$)/.test(lower)) {
    return "major_outage";
  }

  // Degraded/performance (lower priority)
  if (lower.includes("degraded") || lower.includes("performance")) {
    return "degraded";
  }

  // Operational (default for severity: "none")
  if (severity === "none") return "operational";

  // Fallback based on severity
  if (severity === "critical") return "major_outage";
  if (severity === "major") return "major_outage";
  if (severity === "minor") return "degraded";

  return "operational";
}
