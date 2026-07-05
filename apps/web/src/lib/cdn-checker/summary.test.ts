import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import type { CdnRegionResponse, CdnRegionResult } from "./schema";
import { computeCdnSummary } from "./summary";

function makeRow(overrides: Partial<CdnRegionResult> = {}): CdnRegionResult {
  return {
    state: "success",
    region: "iad",
    cacheStatus: "HIT",
    cacheStatusRaw: "cf-cache-status: HIT",
    edgeIp: null,
    edgePop: "IAD",
    edgePopLocation: "Ashburn, USA",
    ttfbMs: 38,
    totalMs: 71,
    statusCode: 200,
    responseSize: 18233,
    age: 842,
    cacheControl: "public, max-age=3600",
    etag: 'W/"abc123"',
    cdn: "cloudflare",
    ...overrides,
  };
}

describe("computeCdnSummary", () => {
  test("counts HIT and STALE as cached, lists the rest as uncached", () => {
    const rows: CdnRegionResponse[] = [
      makeRow({ region: "iad", cacheStatus: "HIT" }),
      makeRow({ region: "ams", cacheStatus: "STALE" }),
      makeRow({ region: "gru", cacheStatus: "MISS" }),
      makeRow({ region: "syd", cacheStatus: "EXPIRED" }),
    ];
    const summary = computeCdnSummary(rows);
    expect(summary.cachedRegions).toBe(2);
    expect(summary.respondedRegions).toBe(4);
    expect(summary.uncachedRegions).toEqual(["gru", "syd"]);
  });

  test("error rows count as unreachable, not uncached", () => {
    const rows: CdnRegionResponse[] = [
      makeRow({ region: "iad" }),
      { state: "error", region: "syd", message: "Timeout" },
    ];
    const summary = computeCdnSummary(rows);
    expect(summary.totalRegions).toBe(2);
    expect(summary.respondedRegions).toBe(1);
    expect(summary.unreachableRegions).toEqual(["syd"]);
    expect(summary.uncachedRegions).toEqual([]);
  });

  test("majority provider wins, mixedCdn flags disagreement", () => {
    const rows: CdnRegionResponse[] = [
      makeRow({ region: "iad", cdn: "cloudflare" }),
      makeRow({ region: "ams", cdn: "cloudflare" }),
      makeRow({ region: "syd", cdn: "fastly" }),
    ];
    const summary = computeCdnSummary(rows);
    expect(summary.cdn).toBe("cloudflare");
    expect(summary.mixedCdn).toBe(true);
  });

  test("tied providers -> null cdn instead of an arbitrary winner", () => {
    const rows: CdnRegionResponse[] = [
      makeRow({ region: "iad", cdn: "cloudflare" }),
      makeRow({ region: "syd", cdn: "fastly" }),
    ];
    const summary = computeCdnSummary(rows);
    expect(summary.cdn).toBeNull();
    expect(summary.mixedCdn).toBe(true);
  });

  test("no provider detected -> null cdn, unknown topology", () => {
    const rows: CdnRegionResponse[] = [makeRow({ cdn: null })];
    const summary = computeCdnSummary(rows);
    expect(summary.cdn).toBeNull();
    expect(summary.mixedCdn).toBe(false);
    expect(summary.topology).toBe("unknown");
    expect(summary.topologyBasis).toBeNull();
  });

  test("topology falls back to provider heuristic without edge IPs", () => {
    const rows: CdnRegionResponse[] = [
      makeRow({ region: "iad" }),
      makeRow({ region: "ams" }),
    ];
    const summary = computeCdnSummary(rows);
    expect(summary.topology).toBe("anycast");
    expect(summary.topologyBasis).toBe("provider");
  });

  test("empty input", () => {
    const summary = computeCdnSummary([]);
    expect(summary.totalRegions).toBe(0);
    expect(summary.cachedRegions).toBe(0);
    expect(summary.cdn).toBeNull();
  });
});
