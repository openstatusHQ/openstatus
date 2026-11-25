import type { Region } from "@openstatus/db/src/schema/constants";

import type { Timing } from "@/lib/checker/utils";
import { wait } from "@/lib/utils";

import { PROBE_TIMEOUT_MS, mapCheckToCdnResult } from "./probe";
import type { CdnRegionResponse } from "./schema";

function makeTiming(ttfb: number, total: number): Timing {
  return {
    dnsStart: 0,
    dnsDone: 0,
    connectStart: 0,
    connectDone: 0,
    tlsHandshakeStart: 0,
    tlsHandshakeDone: 0,
    firstByteStart: 0,
    firstByteDone: ttfb,
    transferStart: ttfb,
    transferDone: total,
  };
}

// dev runs without CRON_SECRET so the checker fleet is unreachable: probe the
// URL directly from the local machine instead. Headers and cache status are
// real; the vantage point is not — every "region" sees the same nearest edge.
export async function devProbeCdnRegion({
  url,
  region,
}: {
  url: string;
  region: Region;
}): Promise<CdnRegionResponse> {
  // jitter so rows stream progressively like the real fan-out
  await wait(50 + Math.random() * 800);

  try {
    const start = performance.now();
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const ttfb = Math.round(performance.now() - start);
    const body = await response.arrayBuffer();
    const total = Math.round(performance.now() - start);

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    // fetch strips content-length on decompressed responses
    headers["content-length"] ??= String(body.byteLength);

    return mapCheckToCdnResult({
      type: "http",
      state: "success",
      region,
      status: response.status,
      latency: total,
      timestamp: Date.now(),
      timing: makeTiming(ttfb, total),
      headers,
    });
  } catch (error) {
    return {
      state: "error",
      region,
      message: error instanceof Error ? error.message : "Request failed",
    };
  }
}
