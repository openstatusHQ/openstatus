import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { noopFlagSchema, OSTinybird } from "./client";

describe("noopFlagSchema", () => {
  test("treats the string 'false' as disabled, not as a truthy string", () => {
    expect(noopFlagSchema.parse("false")).toBe(false);
    expect(noopFlagSchema.parse("0")).toBe(false);
    expect(noopFlagSchema.parse("")).toBe(false);
  });

  test("enables on the documented truthy spellings", () => {
    expect(noopFlagSchema.parse("true")).toBe(true);
    expect(noopFlagSchema.parse("1")).toBe(true);
  });

  test("passes booleans through for schemas that already coerced", () => {
    expect(noopFlagSchema.parse(true)).toBe(true);
    expect(noopFlagSchema.parse(false)).toBe(false);
  });

  test("defaults to disabled when unset or unrecognised", () => {
    expect(noopFlagSchema.parse(undefined)).toBe(false);
    expect(noopFlagSchema.parse("nope")).toBe(false);
  });
});

describe("OSTinybird", () => {
  test("no-ops under NODE_ENV=test even when the call site asks for a real client", async () => {
    const tb = new OSTinybird({
      token: "a-token",
      // Unroutable on purpose: a real client would reject instead of resolving.
      baseUrl: "http://127.0.0.1:1",
      noop: false,
    });

    expect(await tb.homeStats({})).toEqual({ meta: [], data: [] });
  });
});

const listV2Getters = [
  "httpListV2Daily",
  "httpListV2Weekly",
  "httpListV2Biweekly",
  "tcpListV2Daily",
  "tcpListV2Weekly",
  "tcpListV2Biweekly",
  "icmpListV2Daily",
  "icmpListV2Weekly",
  "icmpListV2Biweekly",
  "dnsListV2Biweekly",
  "grpcListV2Biweekly",
] as const;

const facetGetters = [
  "httpListFacets",
  "tcpListFacets",
  "icmpListFacets",
  "dnsListFacets",
  "grpcListFacets",
] as const;

describe("v2 response-log list pipes", () => {
  const tb = new OSTinybird({ token: "a-token" });

  for (const name of listV2Getters) {
    test(`${name} rejects a limit outside the pipe ceiling`, async () => {
      await expect(tb[name]({ monitorId: "1", limit: 1001 })).rejects.toThrow();
      await expect(tb[name]({ monitorId: "1", limit: 0 })).rejects.toThrow();
    });

    test(`${name} rejects an unknown direction`, async () => {
      await expect(
        tb[name]({
          monitorId: "1",
          limit: 50,
          direction: "sideways" as unknown as "next",
        }),
      ).rejects.toThrow();
    });

    test(`${name} accepts a filtered cursor page`, async () => {
      expect(
        await tb[name]({
          monitorId: "1",
          limit: 50,
          cursor: 1_700_000_000_000,
          direction: "prev",
          fromDate: 1_699_000_000_000,
          toDate: 1_700_000_000_000,
          regions: ["ams"],
          status: ["error"],
          trigger: ["cron"],
          latencyMin: 0,
          latencyMax: 1000,
        }),
      ).toEqual({ meta: [], data: [] });
    });
  }

  test("httpListV2Biweekly accepts a status-code filter", async () => {
    expect(
      await tb.httpListV2Biweekly({
        monitorId: "1",
        limit: 50,
        statusCodes: [200, 500],
      }),
    ).toEqual({ meta: [], data: [] });
  });

  test("httpListV2Biweekly rejects oversized filter arrays", async () => {
    await expect(
      tb.httpListV2Biweekly({
        monitorId: "1",
        limit: 50,
        regions: Array.from({ length: 129 }, (_, i) => `r${i}`),
      }),
    ).rejects.toThrow();
    await expect(
      tb.httpListV2Biweekly({
        monitorId: "1",
        limit: 50,
        statusCodes: Array.from({ length: 101 }, (_, i) => i),
      }),
    ).rejects.toThrow();
  });
});

describe("response-log facet pipes", () => {
  const tb = new OSTinybird({ token: "a-token" });

  for (const name of facetGetters) {
    test(`${name} rejects a non-array region filter`, async () => {
      await expect(
        tb[name]({
          monitorId: "1",
          regions: "ams" as unknown as string[],
        }),
      ).rejects.toThrow();
    });

    test(`${name} accepts the filter set without a cursor`, async () => {
      expect(
        await tb[name]({
          monitorId: "1",
          fromDate: 1_699_000_000_000,
          toDate: 1_700_000_000_000,
          regions: ["ams"],
          status: ["error"],
          trigger: ["cron"],
          latencyMin: 0,
          latencyMax: 1000,
        }),
      ).toEqual({ meta: [], data: [] });
    });
  }
});
