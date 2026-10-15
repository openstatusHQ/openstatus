import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { z } from "zod";

import {
  isWholeHourTimeZone,
  noopFlagSchema,
  OSTinybird,
  status60mParameters,
  status60mShape,
} from "./client";

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

const status60mGetters = [
  "httpStatus60m",
  "tcpStatus60m",
  "dnsStatus60m",
  "icmpStatus60m",
  "grpcStatus60m",
] as const;

describe("isWholeHourTimeZone", () => {
  test("accepts zones whose standard and DST offsets are both whole hours", () => {
    for (const tz of ["UTC", "Etc/GMT+1", "Asia/Tokyo", "Europe/Berlin"]) {
      expect(isWholeHourTimeZone(tz)).toBe(true);
    }
    expect(isWholeHourTimeZone("America/New_York")).toBe(true);
    expect(isWholeHourTimeZone("Australia/Sydney")).toBe(true);
  });

  test("rejects half- and quarter-hour offsets, on either side of DST", () => {
    expect(isWholeHourTimeZone("Asia/Kolkata")).toBe(false);
    expect(isWholeHourTimeZone("Asia/Kathmandu")).toBe(false);
    expect(isWholeHourTimeZone("Pacific/Chatham")).toBe(false);
    // +10:30 standard, +11:00 daylight: whole-hour for half the year only
    expect(isWholeHourTimeZone("Australia/Lord_Howe")).toBe(false);
  });

  test("rejects unknown zones and fixed offsets instead of throwing", () => {
    expect(isWholeHourTimeZone("Mars/Olympus")).toBe(false);
    expect(isWholeHourTimeZone("")).toBe(false);
  });
});

describe("status60mParameters", () => {
  test("defaults timezone to UTC", () => {
    expect(status60mParameters.parse({ monitorIds: ["1"] })).toEqual({
      monitorIds: ["1"],
      timezone: "UTC",
    });
  });

  test("forwards a whole-hour timezone untouched", () => {
    expect(
      status60mParameters.parse({
        monitorIds: ["1", "2"],
        timezone: "Europe/Berlin",
      }).timezone,
    ).toBe("Europe/Berlin");
  });

  test("names the whole-hour requirement when rejecting", () => {
    const result = status60mParameters.safeParse({
      monitorIds: ["1"],
      timezone: "Asia/Kolkata",
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("whole hour");
  });
});

describe("status60mShape", () => {
  const shape = status60mShape(z.coerce.string());

  test("re-keys the local calendar date as UTC midnight, like the 45d pipes", () => {
    const row = shape.parse({
      day: "2026-10-14",
      count: 10,
      ok: 9,
      degraded: 0,
      error: 1,
      monitorId: 1,
    });
    expect(row.day).toBe("2026-10-14T00:00:00.000Z");
    // the key every day-indexed consumer derives must be the local date itself
    expect(new Date(row.day).toISOString().split("T")[0]).toBe("2026-10-14");
    expect(row.monitorId).toBe("1");
  });

  test("rejects a datetime or epoch `day`, which would re-introduce the UTC shift", () => {
    for (const day of [
      "2026-10-13 22:00:00",
      "2026-10-13T22:00:00.000Z",
      1760392800000,
    ]) {
      expect(
        shape.safeParse({
          day,
          count: 0,
          ok: 0,
          degraded: 0,
          error: 0,
          monitorId: "1",
        }).success,
      ).toBe(false);
    }
  });

  test("defaults missing counters to 0", () => {
    expect(shape.parse({ day: "2026-01-01", monitorId: "1" })).toMatchObject({
      count: 0,
      ok: 0,
      degraded: 0,
      error: 0,
    });
  });
});

describe("hourly status pipes", () => {
  const tb = new OSTinybird({ token: "a-token" });

  for (const name of status60mGetters) {
    test(`${name} validates timezone before the request`, async () => {
      await expect(
        tb[name]({ monitorIds: ["1"], timezone: "Asia/Kolkata" }),
      ).rejects.toThrow("whole hour");
    });

    test(`${name} resolves for whole-hour zones and when timezone is omitted`, async () => {
      expect(
        await tb[name]({ monitorIds: ["1"], timezone: "Europe/Berlin" }),
      ).toEqual({ meta: [], data: [] });
      expect(await tb[name]({ monitorIds: ["1"] })).toEqual({
        meta: [],
        data: [],
      });
    });
  }
});
