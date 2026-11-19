import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";
import { z } from "zod";

import {
  attemptsSchema,
  bad15mParameters,
  bad15mShape,
  isValidTimeZone,
  noopFlagSchema,
  OSTinybird,
  runs45dParameters,
  runs45dShape,
  status45dParameters,
  status15mParameters,
  status15mShape,
} from "./client";

describe("attemptsSchema", () => {
  test("keeps the stored value", () => {
    expect(attemptsSchema.parse(3)).toBe(3);
  });

  test("reads as 1 for rows and endpoints without the column", () => {
    expect(attemptsSchema.parse(undefined)).toBe(1);
  });
});

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

const status15mGetters = [
  "httpStatus15m",
  "tcpStatus15m",
  "dnsStatus15m",
  "icmpStatus15m",
  "grpcStatus15m",
] as const;

describe("status15mParameters", () => {
  test("defaults timezone to UTC", () => {
    expect(status15mParameters.parse({ monitorIds: ["1"] })).toEqual({
      monitorIds: ["1"],
      timezone: "UTC",
    });
  });

  test("forwards any zone untouched, fractional offsets included", () => {
    for (const timezone of [
      "Europe/Berlin",
      "Asia/Kolkata",
      "Asia/Kathmandu",
    ]) {
      expect(
        status15mParameters.parse({ monitorIds: ["1", "2"], timezone })
          .timezone,
      ).toBe(timezone);
    }
  });

  test("rejects zone names ClickHouse would 400 on, before the request", () => {
    for (const timezone of ["Mars/Olympus", "", "GMT+1", "+05:30", "-03:00"]) {
      const result = status15mParameters.safeParse({
        monitorIds: ["1"],
        timezone,
      });
      expect(result.success).toBe(false);
    }
    expect(isValidTimeZone("Etc/GMT+1")).toBe(true);
  });
});

describe("status15mShape", () => {
  const shape = status15mShape(z.coerce.string());

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

describe("15m status pipes", () => {
  const tb = new OSTinybird({ token: "a-token" });

  for (const name of status15mGetters) {
    test(`${name} resolves for any zone and when timezone is omitted`, async () => {
      expect(
        await tb[name]({ monitorIds: ["1"], timezone: "Asia/Kolkata" }),
      ).toEqual({ meta: [], data: [] });
      expect(await tb[name]({ monitorIds: ["1"] })).toEqual({
        meta: [],
        data: [],
      });
    });
  }
});

const runs45dGetters = [
  "httpRuns45d",
  "tcpRuns45d",
  "dnsRuns45d",
  "icmpRuns45d",
  "grpcRuns45d",
] as const;

describe.each([
  ["runs45dParameters", runs45dParameters],
  ["status45dParameters", status45dParameters],
] as const)("%s", (_, schema) => {
  test("sends monitorIds only when no window is asked for", () => {
    expect(
      schema.parse({ monitorIds: ["1", "666"], type: "runs" }),
    ).toStrictEqual({ monitorIds: ["1", "666"] });
  });

  test("passes a window of up to the 76-day retention", () => {
    expect(schema.parse({ monitorIds: ["1"], days: 76 })).toEqual({
      monitorIds: ["1"],
      days: 76,
    });
  });

  test("rejects a window outside 1..76 days", () => {
    for (const days of [0, 77, 1.5]) {
      expect(schema.safeParse({ monitorIds: ["1"], days }).success).toBe(false);
    }
  });
});

describe("runs45dParameters timezone", () => {
  test("passes an IANA zone through", () => {
    expect(
      runs45dParameters.parse({ monitorIds: ["1"], timezone: "Europe/Berlin" }),
    ).toEqual({ monitorIds: ["1"], timezone: "Europe/Berlin" });
  });

  test("rejects a zone ClickHouse does not know", () => {
    for (const timezone of ["Mars/Base", "+05:30"]) {
      expect(
        runs45dParameters.safeParse({ monitorIds: ["1"], timezone }).success,
      ).toBe(false);
    }
  });
});

describe("runs45dShape", () => {
  test("re-keys the UTC day as an ISO midnight and defaults missing counts", () => {
    expect(
      runs45dShape.parse({
        day: "2026-06-14 00:00:00",
        monitorId: "1",
        count: 144,
        ok: 140,
      }),
    ).toEqual({
      day: "2026-06-14T00:00:00.000Z",
      monitorId: "1",
      count: 144,
      ok: 140,
      degraded: 0,
      error: 0,
    });
  });
});

describe("runs 45d pipes", () => {
  const tb = new OSTinybird({ token: "a-token" });

  for (const name of runs45dGetters) {
    test(`${name} resolves`, async () => {
      expect(await tb[name]({ monitorIds: ["1"] })).toEqual({
        meta: [],
        data: [],
      });
    });
  }
});

const bad15mJobTypes = ["http", "tcp", "dns", "icmp", "grpc"] as const;

describe("bad15mParameters", () => {
  test("sends monitorIds and the epoch-ms window", () => {
    expect(
      bad15mParameters.parse({
        monitorIds: ["1"],
        fromDate: 1_790_812_800_000,
        toDate: 1_793_491_200_000,
      }),
    ).toEqual({
      monitorIds: ["1"],
      fromDate: 1_790_812_800_000,
      toDate: 1_793_491_200_000,
    });
  });

  test("requires the window", () => {
    expect(bad15mParameters.safeParse({ monitorIds: ["1"] }).success).toBe(
      false,
    );
  });
});

describe("bad15mShape", () => {
  const shape = bad15mShape(z.coerce.string());

  test("renames the counters and keeps the UTC day and bucket", () => {
    expect(
      shape.parse({
        monitorId: 7,
        day: "2026-10-31",
        bucket: 95,
        degradedCount: 0,
        errorCount: 30,
      }),
    ).toEqual({
      monitorId: "7",
      day: "2026-10-31",
      bucket: 95,
      degraded: 0,
      error: 30,
    });
  });

  test("rejects a bucket outside the day", () => {
    expect(
      shape.safeParse({
        monitorId: "7",
        day: "2026-10-31",
        bucket: 96,
        degradedCount: 0,
        errorCount: 1,
      }).success,
    ).toBe(false);
  });
});

describe("bad 15m pipes", () => {
  const tb = new OSTinybird({ token: "a-token" });
  const params = {
    monitorIds: ["1"],
    fromDate: 1_790_812_800_000,
    toDate: 1_793_491_200_000,
  };

  for (const type of bad15mJobTypes) {
    for (const name of [`${type}StatusBad15m`, `${type}RunsBad15m`] as const) {
      test(`${name} resolves`, async () => {
        expect(await tb[name](params)).toEqual({ meta: [], data: [] });
      });
    }
  }
});

describe("bad 15m endpoint SQL", () => {
  const endpoint = (name: string) =>
    readFileSync(
      join(import.meta.dirname, "../endpoints", `${name}.pipe`),
      "utf8",
    );
  const quorum = [
    "uniqExactMerge(regions) AS n",
    "uniqExactMerge(errorRegions) AS e",
    "uniqExactMerge(degradedRegions) AS d",
    "countIf(e * 2 >= n)",
    "countIf(e * 2 < n AND (e + d) * 2 >= n)",
  ];

  for (const type of bad15mJobTypes) {
    test(`${type} runs variant judges runs like the 45d runs endpoint`, () => {
      const runs45d = endpoint(`endpoint__${type}_runs_45d__v0`);
      const bad = endpoint(`endpoint__${type}_runs_bad_15m__v0`);
      for (const expr of quorum) {
        expect(runs45d).toContain(expr);
        expect(bad).toContain(expr);
      }
      expect(bad).toContain(`FROM mv__${type}_runs_45d__v0`);
      expect(bad).toContain(
        `"endpoint__${type}_runs_bad_15m__v0_endpoint_read"`,
      );
    });

    test(`${type} status variant reads the 15m view`, () => {
      const bad = endpoint(`endpoint__${type}_status_bad_15m__v0`);
      expect(bad).toContain(`FROM mv__${type}_status_15m__v0`);
      expect(bad).toContain(
        `"endpoint__${type}_status_bad_15m__v0_endpoint_read"`,
      );
      expect(bad).toContain("countMerge(degraded)");
      expect(bad).toContain("countMerge(error)");
    });
  }
});
