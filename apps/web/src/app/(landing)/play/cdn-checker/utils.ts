import type { CacheStatus } from "@openstatus/header-analysis";

export const CACHE_STATUS_COLOR: Record<CacheStatus, string> = {
  HIT: "bg-success",
  STALE: "bg-success/80",
  EXPIRED: "bg-warning",
  MISS: "bg-destructive",
  BYPASS: "bg-muted-foreground",
  DYNAMIC: "bg-info",
  UNKNOWN: "bg-muted-foreground",
};

export const CACHE_STATUS_DESCRIPTION: Record<CacheStatus, string> = {
  HIT: "Served from the edge cache",
  STALE: "Served from cache while revalidating with origin",
  EXPIRED: "Found in cache but expired — fetched from origin",
  MISS: "Not in cache — fetched from origin",
  BYPASS: "Caching explicitly bypassed for this asset",
  DYNAMIC: "Not eligible for caching",
  UNKNOWN: "No cache headers detected",
};

export function formatAge(seconds: number | null): string {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}
