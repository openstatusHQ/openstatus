import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import {
  OSTinybird,
  slaEpisodesRangeParameters,
  slaEpisodesRangeShape,
} from "./client";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const types = ["http", "tcp", "dns", "icmp", "grpc"] as const;
const defaultIds = {
  http: "1,666",
  tcp: "4433",
  dns: "7417",
  icmp: "4433",
  grpc: "4433",
};

const lines = (sql: string, pattern: RegExp) =>
  sql
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => pattern.test(line));

const episodesPipe = (type: string) =>
  read(`endpoints/endpoint__${type}_sla_episodes_range__v0.pipe`);

// Tinybird is unreachable in CI: these assert the SQL text encodes SPEC's
// "Weight and unmeasured time" rule; the TS reference owns the semantics.
describe.each(types)("%s sla episodes range", (type) => {
  const episodes = episodesPipe(type);
  const range = read(`endpoints/endpoint__${type}_runs_range__v0.pipe`);

  test("reads the runs view without a new materialization", () => {
    expect(episodes).toContain(`FROM mv__${type}_runs_45d__v0\n`);
    expect(episodes).not.toMatch(/mv__(?!\w+_runs_45d__v0)\w+/);
  });

  test("judges each run with the runs range quorum", () => {
    const merges = /^uniqExactMerge/;
    expect(lines(episodes, merges)).toHaveLength(3);
    expect(lines(episodes, merges)).toEqual(lines(range, merges));
    expect(range).toContain("countIf(e * 2 >= n) AS error");
    expect(range).toContain(
      "countIf(e * 2 < n AND (e + d) * 2 >= n) AS degraded",
    );
    expect(episodes).toContain(
      "multiIf(e * 2 >= n, 'error', (e + d) * 2 >= n, 'degraded', 'ok') AS kind",
    );
    expect(episodes).toContain("GROUP BY monitorId, cronTimestamp");
  });

  test("selects runs with the runs range filter", () => {
    const filter = /^(AND )?(time|cronTimestamp) [<>]=? /;
    expect(lines(episodes, filter)).toHaveLength(4);
    expect(lines(episodes, filter)).toEqual(lines(range, filter));
  });

  test("takes the half-open range and fallback cadence as required Int64 params", () => {
    expect(episodes).toMatch(/Int64\(fromDate, \d+, required=True\)/);
    expect(episodes).toMatch(/Int64\(toDate, \d+, required=True\)/);
    expect(episodes).toMatch(/Int64\(fallbackIntervalMs, \d+, required=True\)/);
    expect(episodes).toContain(
      `Array(monitorIds, 'String', '${defaultIds[type]}')`,
    );
  });

  test("looks at neighbouring runs per monitor over an explicit full frame", () => {
    expect(episodes).toContain(
      "PARTITION BY monitorId ORDER BY cronTimestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING",
    );
    expect(episodes).toContain(
      "lagInFrame(cronTimestamp, 1) OVER byTime AS prev1",
    );
    expect(episodes).toContain(
      "leadInFrame(cronTimestamp, 1) OVER byTime AS next1",
    );
    expect(episodes).toContain(
      "leadInFrame(cronTimestamp, 2) OVER byTime AS next2",
    );
  });

  test("weights each run by SPEC's gap and cadence rule", () => {
    // g: to the next run, or to toMs for the last run
    expect(episodes).toContain("if(i = k, toMs - t, next1 - t) AS g");
    // c: max(gap before A, gap after B); last run uses the gap before it, a lone run the fallback
    expect(episodes).toContain("i = k AND k = 1, fallbackMs,");
    expect(episodes).toContain("i = k, t - prev1,");
    expect(episodes).toContain(
      "greatest(if(i = 1, g, t - prev1), if(i + 1 = k, g, next2 - next1))",
    );
    expect(episodes).toContain("if(g <= 2 * c, g, c) AS weightMs");
    expect(episodes).toContain("g - weightMs AS unmeasuredMs");
    // head [fromMs, F): F's verdict when within 2 × (gap after F, or the fallback)
    expect(episodes).toContain(
      "(i = 1 AND headGapMs <= 2 * if(k = 1, fallbackMs, next1 - t)) AS headWeighted",
    );
  });

  test("starts a new episode on a verdict change or after unmeasured time", () => {
    expect(episodes).toContain(
      "i = 1 OR kind != prevKind OR prevUnmeasuredMs > 0",
    );
    expect(episodes).toContain(
      "PARTITION BY monitorId ORDER BY t ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW",
    );
  });

  test("reports a monitor without runs as one unmeasured episode", () => {
    expect(episodes).toContain(
      `arrayJoin({{ Array(monitorIds, 'String', '${defaultIds[type]}') }}) AS monitorId`,
    );
    expect(episodes).toContain("WHERE monitorId NOT IN (");
  });

  test("returns episode rows ordered per monitor", () => {
    expect(episodes).toContain(
      "SELECT monitorId, kind, startedAt, endedAt, runs, weightedMs",
    );
    expect(episodes).toContain("ORDER BY monitorId, startedAt");
  });

  test("points at the shared fixture", () => {
    expect(episodes).toContain(
      "packages/services/src/monitor-reporting/__tests__/fixtures/episodes.json",
    );
  });

  test("differs from the http pipe only in its type and sample ids", () => {
    const normalized = episodes
      .replaceAll(type, "TYPE")
      .replaceAll(defaultIds[type], "IDS");
    const http = episodesPipe("http")
      .replaceAll("http", "TYPE")
      .replaceAll(defaultIds.http, "IDS");
    expect(normalized).toEqual(http);
  });
});

describe("slaEpisodesRangeParameters", () => {
  test("requires the range and the fallback cadence in milliseconds", () => {
    const input = {
      monitorIds: ["1"],
      fromDate: 1_761_955_200_000,
      toDate: 1_764_547_200_000,
      fallbackIntervalMs: 60_000,
    };
    expect(slaEpisodesRangeParameters.parse(input)).toEqual(input);
    expect(
      slaEpisodesRangeParameters.safeParse({
        ...input,
        fallbackIntervalMs: undefined,
      }).success,
    ).toBe(false);
  });
});

describe("slaEpisodesRangeShape", () => {
  test("parses an episode row", () => {
    const row = {
      monitorId: "1",
      kind: "unmeasured",
      startedAt: 1_761_955_200_000,
      endedAt: 1_761_962_400_000,
      runs: 0,
      weightedMs: 7_200_000,
    };
    expect(slaEpisodesRangeShape.parse(row)).toEqual(row);
  });

  test("rejects an unknown kind", () => {
    expect(
      slaEpisodesRangeShape.safeParse({
        monitorId: "1",
        kind: "success",
        startedAt: 0,
        endedAt: 1,
        runs: 1,
        weightedMs: 1,
      }).success,
    ).toBe(false);
  });
});

describe("sla episodes range pipes", () => {
  const tb = new OSTinybird({ token: "a-token" });

  for (const name of [
    "httpSlaEpisodesRange",
    "tcpSlaEpisodesRange",
    "dnsSlaEpisodesRange",
    "icmpSlaEpisodesRange",
    "grpcSlaEpisodesRange",
  ] as const) {
    test(`${name} resolves`, async () => {
      expect(
        await tb[name]({
          monitorIds: ["1"],
          fromDate: 0,
          toDate: 1,
          fallbackIntervalMs: 60_000,
        }),
      ).toEqual({ meta: [], data: [] });
    });
  }
});
