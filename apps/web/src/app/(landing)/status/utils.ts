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
