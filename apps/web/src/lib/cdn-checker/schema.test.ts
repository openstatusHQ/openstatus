import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { cdnRegionResponseSchema, cdnSummarySchema } from "./schema";

const success = {
  region: "ams",
  cacheStatus: "HIT",
  cacheStatusRaw: "cf-cache-status: HIT",
  edgeIp: null,
  edgePop: null,
  edgePopLocation: null,
  ttfbMs: 10,
  totalMs: 20,
  statusCode: 200,
  responseSize: null,
  age: null,
  cacheControl: null,
  etag: null,
  cdn: null,
};

describe("cdnRegionResponseSchema", () => {
  test("defaults a result without a state to success", () => {
    expect(cdnRegionResponseSchema.parse(success).state).toBe("success");
  });

  test("parses a success result", () => {
    expect(
      cdnRegionResponseSchema.parse({ ...success, state: "success" }).state,
    ).toBe("success");
  });

  test("parses an error result", () => {
    expect(
      cdnRegionResponseSchema.parse({
        state: "error",
        region: "syd",
        message: "Timeout",
      }),
    ).toEqual({ state: "error", region: "syd", message: "Timeout" });
  });

  test("rejects an unknown cache status", () => {
    expect(
      cdnRegionResponseSchema.safeParse({
        ...success,
        state: "success",
        cacheStatus: "WARM",
      }).success,
    ).toBe(false);
  });
});

describe("cdnSummarySchema", () => {
  const summary = {
    totalRegions: 2,
    respondedRegions: 2,
    cachedRegions: 1,
    uncachedRegions: ["ams"],
    unreachableRegions: [],
    cdn: null,
    mixedCdn: false,
    topology: "unknown",
    topologyBasis: null,
  };

  test("defaults the type to summary", () => {
    expect(cdnSummarySchema.parse(summary).type).toBe("summary");
  });

  test("rejects an unknown topology", () => {
    expect(
      cdnSummarySchema.safeParse({ ...summary, topology: "multicast" }).success,
    ).toBe(false);
  });
});
