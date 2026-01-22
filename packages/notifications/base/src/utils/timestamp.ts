/**
 * Format cron timestamp (epoch ms) to ISO string
 *
 * @example
 * formatTimestamp(1737553800000) // "2026-01-22T14:30:00.000Z"
 *
 * @param cronTimestamp - Epoch timestamp in milliseconds
 * @returns Formatted timestamp string to ISO string
 */
export function formatTimestamp(cronTimestamp: number): string {
  if (!cronTimestamp || !Number.isFinite(cronTimestamp)) {
    return "Unknown";
  }

  const date = new Date(cronTimestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toISOString();
}
