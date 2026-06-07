import { parseCacheControlHeader } from "../parser/cache-control";
import { getHeader } from "./get-header";

export const CACHE_STATUSES = [
  "HIT",
  "MISS",
  "EXPIRED",
  "STALE",
  "BYPASS",
  "DYNAMIC",
  "UNKNOWN",
] as const;

export type CacheStatus = (typeof CACHE_STATUSES)[number];

export interface NormalizedCacheStatus {
  status: CacheStatus;
  /** original header value, e.g. "Hit from cloudfront" */
  raw: string | null;
  /** header name that determined the status, e.g. "cf-cache-status" */
  source: string | null;
}

function fromToken(value: string): CacheStatus | null {
  const token = value.toUpperCase();
  // order matters: "REFRESH_HIT" and "EXPIRED_MISS" must not match plain HIT/MISS
  if (token.includes("STALE")) return "STALE";
  if (token.includes("UPDATING")) return "STALE";
  if (token.includes("EXPIRED")) return "EXPIRED";
  if (token.includes("REFRESH")) return "EXPIRED";
  if (token.includes("REVALIDATED")) return "HIT";
  if (token.includes("PRERENDER")) return "HIT";
  if (token.includes("BYPASS")) return "BYPASS";
  if (token.includes("DYNAMIC")) return "DYNAMIC";
  if (token.includes("HIT")) return "HIT";
  if (token.includes("MISS")) return "MISS";
  if (token.includes("PASS")) return "BYPASS";
  return null;
}

// RFC 9211, e.g. `"Netlify Edge"; hit` or `ExampleCache; fwd=miss; stored`
function fromCacheStatusHeader(value: string): CacheStatus | null {
  const lower = value.toLowerCase();
  if (/;\s*hit/.test(lower)) return "HIT";
  const fwd = lower.match(/fwd=([a-z-]+)/)?.[1];
  if (!fwd) return null;
  if (fwd === "bypass") return "BYPASS";
  if (fwd === "stale") return "EXPIRED";
  return "MISS";
}

const VENDOR_HEADERS = [
  "cf-cache-status",
  "x-vercel-cache",
  "cache-status",
  "x-cache",
  "x-cache-status",
  "cdn-cache",
  "x-cache-lookup",
] as const;

export function normalizeCacheStatus(
  headers: Record<string, string>,
): NormalizedCacheStatus {
  for (const name of VENDOR_HEADERS) {
    const value = getHeader(headers, name);
    if (!value) continue;
    const status =
      name === "cache-status" ? fromCacheStatusHeader(value) : fromToken(value);
    if (status) return { status, raw: value, source: name };
  }

  // no vendor header: infer from standard caching headers
  const age = getHeader(headers, "age");
  const cacheControl = getHeader(headers, "cache-control");

  if (cacheControl) {
    const directives = parseCacheControlHeader(cacheControl);
    // directive names are case-insensitive per RFC 9111
    const has = (name: string) =>
      directives.some((d) => d.name.toLowerCase() === name);
    if (has("no-store") || has("private")) {
      return { status: "DYNAMIC", raw: cacheControl, source: "cache-control" };
    }
    if (age && Number.parseInt(age, 10) > 0) {
      return { status: "HIT", raw: age, source: "age" };
    }
  }

  return { status: "UNKNOWN", raw: null, source: null };
}
