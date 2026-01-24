/**
 * Format milliseconds to human-readable duration
 *
 * @example
 * formatDuration(30000) // "30s"
 * formatDuration(135000) // "2m 15s"
 * formatDuration(8130000) // "2h 15m 30s"
 * formatDuration(90000000) // "1d 1h"
 *
 * @param durationMs - Duration in milliseconds
 * @param options - Formatting options
 * @param options.maxUnits - Max number of units to show (default: 3)
 * @returns Formatted duration string
 */
export function formatDuration(
  durationMs: number,
  options?: {
    maxUnits?: number;
  },
): string {
  const maxUnits = options?.maxUnits ?? 3;

  if (durationMs < 0) {
    return "0s";
  }

  const totalSeconds = Math.floor(durationMs / 1000);

  if (totalSeconds === 0) {
    return "0s";
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0) {
    parts.push(`${seconds}s`);
  }

  // Take only the first maxUnits parts
  return parts.slice(0, maxUnits).join(" ");
}

/**
 * Calculate duration between two timestamps
 *
 * @param start - Start date
 * @param end - End date
 * @returns Duration in milliseconds
 */
export function calculateDuration(start: Date, end: Date): number {
  return end.getTime() - start.getTime();
}
