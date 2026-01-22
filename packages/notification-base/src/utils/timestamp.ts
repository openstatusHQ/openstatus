import { format } from "date-fns";

/**
 * Format cron timestamp (epoch ms) to human-readable string
 *
 * @example
 * formatTimestamp(1737553800000) // "Jan 22, 2026 at 14:30 UTC"
 *
 * @param cronTimestamp - Epoch timestamp in milliseconds
 * @returns Formatted timestamp string
 */
export function formatTimestamp(cronTimestamp: number): string {
  if (!cronTimestamp || !Number.isFinite(cronTimestamp)) {
    return "Unknown";
  }

  const date = new Date(cronTimestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return format(date, "MMM dd, yyyy 'at' HH:mm 'UTC'");
}
