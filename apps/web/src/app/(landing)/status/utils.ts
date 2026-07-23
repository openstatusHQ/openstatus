export const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export function formatRelative(updatedAtMs: number): string {
  const diff = Date.now() - updatedAtMs;
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function isStale(fetchedAtMs: number): boolean {
  return Date.now() - fetchedAtMs > STALE_THRESHOLD_MS;
}

// Natural-language answer to "Is <name> down?", used both as on-page lead copy
// and as the FAQPage answer in JSON-LD. Mirrors getPillStyle semantics.
export function getStatusAnswer(args: {
  name: string;
  indicator: string;
  status: string;
  hasLiveData: boolean;
}): string {
  const { name, indicator, status, hasLiveData } = args;
  if (!hasLiveData) {
    return `We don't have live data for ${name} right now. Check the official ${name} status page below.`;
  }
  if (status === "under_maintenance") {
    return `${name} is currently undergoing scheduled maintenance.`;
  }
  switch (indicator) {
    case "none":
      return `No, ${name} is not down. All ${name} systems are operational.`;
    case "minor":
      return `${name} is up, but currently experiencing a minor issue.`;
    case "major":
      return `Yes, ${name} is experiencing a partial outage right now.`;
    case "critical":
      return `Yes, ${name} is down. A major outage is currently affecting ${name}.`;
    default:
      return `The current status of ${name} is unknown. Check the official ${name} status page below.`;
  }
}
