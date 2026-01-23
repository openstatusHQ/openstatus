import type { Incident } from "@openstatus/db/src/schema";
import { formatDuration } from "./duration";

/**
 * Get formatted incident duration
 *
 * Returns duration string only if incident is resolved (has resolvedAt timestamp).
 * Returns null for ongoing incidents or if startedAt is missing.
 *
 * @example
 * // Resolved incident
 * getIncidentDuration({
 *   startedAt: new Date('2026-01-22T10:00:00Z'),
 *   resolvedAt: new Date('2026-01-22T12:15:30Z')
 * }) // "2h 15m 30s"
 *
 * // Ongoing incident
 * getIncidentDuration({
 *   startedAt: new Date('2026-01-22T10:00:00Z'),
 *   resolvedAt: null
 * }) // null
 *
 * @param incident - The incident object
 * @returns Formatted duration string or null if incident is not resolved
 */
export function getIncidentDuration(incident: Incident): string | null {
  if (!incident.startedAt) {
    return null;
  }

  // Only calculate duration for resolved incidents
  if (!incident.resolvedAt) {
    return null;
  }

  const startTime =
    incident.startedAt instanceof Date
      ? incident.startedAt.getTime()
      : incident.startedAt;

  const endTime =
    incident.resolvedAt instanceof Date
      ? incident.resolvedAt.getTime()
      : incident.resolvedAt;

  const durationMs = endTime - startTime;

  if (durationMs < 0) {
    return null;
  }

  return formatDuration(durationMs);
}
