import type { Region } from "@openstatus/db/src/schema/constants";
import {
  detectCdn,
  extractEdgePop,
  getHeader,
  normalizeCacheStatus,
} from "@openstatus/header-analysis";

import {
  type RegionCheckerResponse,
  checkRegion,
  getTimingPhases,
} from "@/lib/checker/utils";

import type { CdnRegionResponse } from "./schema";

// the checker downloads the full body before responding; capping after
// headers needs a Go-side change, so keep a generous per-region budget
export const PROBE_TIMEOUT_MS = 12_000;

export function mapCheckToCdnResult(
  check: RegionCheckerResponse,
): CdnRegionResponse {
  if (check.state === "error") {
    return { state: "error", region: check.region, message: check.message };
  }

  const { headers } = check;
  const cache = normalizeCacheStatus(headers);
  const { provider } = detectCdn(headers);
  const { pop, location } = extractEdgePop(headers, provider);

  const contentLength = getHeader(headers, "content-length");
  const responseSize = contentLength
    ? Number.parseInt(contentLength, 10)
    : check.body
      ? new TextEncoder().encode(check.body).length
      : null;

  const age = getHeader(headers, "age");
  const parsedAge = age ? Number.parseInt(age, 10) : Number.NaN;

  return {
    state: "success",
    region: check.region,
    cacheStatus: cache.status,
    cacheStatusRaw: cache.source ? `${cache.source}: ${cache.raw}` : null,
    edgeIp: null, // requires a checker-side change to capture; see plan phase 5
    edgePop: pop,
    edgePopLocation: location,
    ttfbMs: Math.round(getTimingPhases(check.timing).ttfb),
    totalMs: Math.round(check.latency),
    statusCode: check.status,
    responseSize: Number.isNaN(responseSize ?? Number.NaN)
      ? null
      : responseSize,
    age: Number.isNaN(parsedAge) ? null : parsedAge,
    cacheControl: getHeader(headers, "cache-control"),
    etag: getHeader(headers, "etag"),
    cdn: provider,
  };
}

export async function probeCdnRegion({
  url,
  region,
  timeoutMs = PROBE_TIMEOUT_MS,
}: {
  url: string;
  region: Region;
  timeoutMs?: number;
}): Promise<CdnRegionResponse> {
  try {
    const check = await checkRegion({
      url,
      region,
      method: "GET",
      // hard abort, not a soft race: the underlying fetch must not keep
      // running (and consuming the edge function budget) after timeout
      signal: AbortSignal.timeout(timeoutMs),
    });
    return mapCheckToCdnResult(check);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "TimeoutError"
          ? "Timeout"
          : error.message
        : "Request failed";
    return { state: "error", region, message };
  }
}
