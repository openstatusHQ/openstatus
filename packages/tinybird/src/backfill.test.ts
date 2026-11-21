import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  backfillBad15mParameters,
  backfillBad15mShape,
  OSTinybird,
} from "./client";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const types = ["http", "tcp", "dns", "icmp", "grpc"] as const;
const rawDatasource = {
  http: "ping_response__v8",
  tcp: "tcp_response__v0",
  dns: "dns_response__v0",
  icmp: "icmp_response__v0",
  grpc: "grpc_response__v0",
} as const;
const target = "frozen_bad_15m_backfill__v0";

describe("backfill datasource", () => {
  const ds = read(`datasources/${target}.datasource`);

  test("a re-run of the same month replaces its rows", () => {
    expect(ds).toContain('ENGINE "ReplacingMergeTree"');
    expect(ds).toContain(
      'ENGINE_SORTING_KEY "month, monitorId, measure, day, bucket"',
    );
    expect(ds).toContain('ENGINE_VER "copiedAt"');
  });

  test("keeps rows forever", () => {
    expect(ds).not.toContain("ENGINE_TTL");
  });
});

describe.each(types)("%s backfill copy pipes", (type) => {
  const status = read(`copies/copy__${type}_status_bad_15m_backfill__v0.pipe`);
  const runs = read(`copies/copy__${type}_runs_bad_15m_backfill__v0.pipe`);

  test.each([
    ["status", status],
    ["runs", runs],
  ])("%s runs on demand into the backfill datasource", (_, pipe) => {
    expect(pipe).toContain("TYPE COPY");
    expect(pipe).toContain(`TARGET_DATASOURCE ${target}`);
    expect(pipe).toContain("COPY_MODE append");
    expect(pipe).not.toContain("COPY_SCHEDULE");
    expect(pipe).toContain(`FROM ${rawDatasource[type]}`);
    expect(pipe).toContain("{{ Date(month,");
    expect(pipe).toContain("{% if defined(monitorIds) %}");
  });

  test("status counts requestStatus like the 15m and 45d status views", () => {
    expect(status).toContain("'requests' AS measure");
    expect(status).toContain("countIf(requestStatus = 'degraded') AS degraded");
    expect(status).toContain("countIf(requestStatus = 'error') AS error");
    expect(status).not.toContain("trigger");
  });

  test("runs filter and judge runs like the 45d runs view and endpoint", () => {
    const view = read(`materializations/aggregate__${type}_runs_45d__v0.pipe`);
    const endpoint = read(`endpoints/endpoint__${type}_runs_45d__v0.pipe`);
    expect(runs).toContain("'runs' AS measure");

    const filters = view
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^(WHERE|AND) /.test(l))
      .map((l) => l.replace(/^WHERE /, "AND "));
    expect(filters.length).toBeGreaterThanOrEqual(2);
    for (const filter of filters) expect(runs).toContain(filter);

    const votes = [...view.matchAll(/uniqExactStateIf\((.*)\) AS \w+,?$/gm)];
    expect(votes.length).toBe(2);
    for (const [, args] of votes)
      expect(runs).toContain(`uniqExactIf(${args})`);

    for (const expr of [
      "countIf(e * 2 >= n)",
      "countIf(e * 2 < n AND (e + d) * 2 >= n)",
    ]) {
      expect(endpoint).toContain(expr);
      expect(runs).toContain(expr);
    }
  });
});

describe("backfill endpoint", () => {
  const endpoint = read("endpoints/endpoint__frozen_bad_15m_backfill__v0.pipe");

  test("reads the deduplicated datasource for one month", () => {
    expect(endpoint).toContain(`FROM ${target} FINAL`);
    expect(endpoint).toContain("month = {{ Date(month");
    expect(endpoint).toContain(
      '"endpoint__frozen_bad_15m_backfill__v0_endpoint_read"',
    );
  });
});

describe("backfillBad15mParameters", () => {
  test("takes a first-of-month and monitor ids", () => {
    expect(
      backfillBad15mParameters.parse({
        month: "2026-08-01",
        monitorIds: ["1"],
      }),
    ).toEqual({ month: "2026-08-01", monitorIds: ["1"] });
  });

  test("rejects a day that is not the first", () => {
    expect(
      backfillBad15mParameters.safeParse({
        month: "2026-08-02",
        monitorIds: ["1"],
      }).success,
    ).toBe(false);
  });
});

describe("backfillBad15mShape", () => {
  test("renames the counters and keeps the measure", () => {
    expect(
      backfillBad15mShape.parse({
        monitorId: "7",
        measure: "runs",
        day: "2026-08-31",
        bucket: 95,
        degradedCount: 1,
        errorCount: 2,
      }),
    ).toEqual({
      monitorId: "7",
      measure: "runs",
      day: "2026-08-31",
      bucket: 95,
      degraded: 1,
      error: 2,
    });
  });

  test("rejects an unknown measure", () => {
    expect(
      backfillBad15mShape.safeParse({
        monitorId: "7",
        measure: "duration",
        day: "2026-08-31",
        bucket: 0,
        degradedCount: 0,
        errorCount: 1,
      }).success,
    ).toBe(false);
  });
});

describe("frozenBad15mBackfill", () => {
  test("resolves", async () => {
    const tb = new OSTinybird({ token: "a-token" });
    expect(
      await tb.frozenBad15mBackfill({ month: "2026-08-01", monitorIds: ["1"] }),
    ).toEqual({ meta: [], data: [] });
  });
});
