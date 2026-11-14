import { describe, expect, test } from "vitest";

import type { Episode } from "../episodes";
import {
  clipEpisodes,
  fetchSlaEpisodes,
  periodicityMs,
  type SlaEpisodesPipeFn,
  type SlaEpisodesPipes,
} from "../fetch-episodes";

const sleep = async () => {};
const FROM = Date.UTC(2026, 10, 1);
const TO = Date.UTC(2026, 10, 2);

function pipesOf(fn: SlaEpisodesPipeFn): SlaEpisodesPipes {
  return { http: fn, tcp: fn, dns: fn, icmp: fn, grpc: fn };
}

const ok = (monitorId: string, startedAt: number, endedAt: number) => ({
  monitorId,
  kind: "ok" as const,
  startedAt,
  endedAt,
  runs: 1,
  weightedMs: endedAt - startedAt,
});

describe("fetchSlaEpisodes", () => {
  test("batches by job type and cadence, passing the cadence as the fallback", async () => {
    const calls: Parameters<SlaEpisodesPipeFn>[0][] = [];
    const res = await fetchSlaEpisodes({
      monitors: [
        { id: 1, jobType: "http", regions: "ams", periodicity: "10m" },
        { id: 2, jobType: "http", regions: "ams", periodicity: "10m" },
        { id: 3, jobType: "http", regions: "ams", periodicity: "30s" },
        { id: 4, jobType: "tcp", regions: "ams", periodicity: "10m" },
        // no run verdicts: never asked, neither failed nor read
        { id: 5, jobType: "http", regions: "", periodicity: "10m" },
        { id: 6, jobType: "heartbeat", regions: "ams", periodicity: "10m" },
      ],
      fromMs: FROM,
      toMs: TO,
      pipes: () =>
        pipesOf(async (params) => {
          calls.push(params);
          return {
            data: params.monitorIds.flatMap((id) => [
              ok(id, FROM + 1000, TO),
              ok(id, FROM, FROM + 1000),
            ]),
          };
        }),
      sleep,
    });
    expect(calls).toEqual([
      {
        monitorIds: ["1", "2"],
        fromDate: FROM,
        toDate: TO,
        fallbackIntervalMs: 600_000,
      },
      {
        monitorIds: ["3"],
        fromDate: FROM,
        toDate: TO,
        fallbackIntervalMs: 30_000,
      },
      {
        monitorIds: ["4"],
        fromDate: FROM,
        toDate: TO,
        fallbackIntervalMs: 600_000,
      },
    ]);
    expect([...res.episodes.keys()].sort()).toEqual([1, 2, 3, 4]);
    // sorted by start, monitorId dropped
    expect(res.episodes.get(1)).toEqual([
      {
        kind: "ok",
        startedAt: FROM,
        endedAt: FROM + 1000,
        runs: 1,
        weightedMs: 1000,
      },
      {
        kind: "ok",
        startedAt: FROM + 1000,
        endedAt: TO,
        runs: 1,
        weightedMs: TO - FROM - 1000,
      },
    ]);
    expect(res.failed.size).toBe(0);
  });

  test("never throws: a chunk that keeps failing reports its monitors", async () => {
    let attempts = 0;
    const res = await fetchSlaEpisodes({
      monitors: [
        { id: 1, jobType: "http", regions: "ams", periodicity: "10m" },
        { id: 2, jobType: "tcp", regions: "ams", periodicity: "10m" },
      ],
      fromMs: FROM,
      toMs: TO,
      pipes: () => ({
        ...pipesOf(async (p) => ({
          data: p.monitorIds.map((id) => ok(id, FROM, TO)),
        })),
        tcp: async () => {
          attempts++;
          throw new Error("tinybird down");
        },
      }),
      sleep,
    });
    expect(attempts).toBe(3);
    expect([...res.failed]).toEqual([2]);
    expect([...res.episodes.keys()]).toEqual([1]);
  });

  test("a client that cannot be built fails every monitor", async () => {
    const res = await fetchSlaEpisodes({
      monitors: [{ id: 1, jobType: "http", regions: "ams", periodicity: "1m" }],
      fromMs: FROM,
      toMs: TO,
      pipes: () => {
        throw new Error("no token");
      },
      sleep,
    });
    expect([...res.failed]).toEqual([1]);
  });

  test("an empty range asks nothing", async () => {
    const res = await fetchSlaEpisodes({
      monitors: [{ id: 1, jobType: "http", regions: "ams", periodicity: "1m" }],
      fromMs: TO,
      toMs: TO,
      pipes: () => {
        throw new Error("must not be built");
      },
      sleep,
    });
    expect(res.failed.size).toBe(0);
    expect(res.episodes.size).toBe(0);
  });
});

describe("periodicityMs", () => {
  test("maps known cadences, unknown ones to an hour", () => {
    expect(periodicityMs("30s")).toBe(30_000);
    expect(periodicityMs("1h")).toBe(3_600_000);
    expect(periodicityMs("other")).toBe(3_600_000);
    expect(periodicityMs("2m")).toBe(3_600_000);
  });
});

describe("clipEpisodes", () => {
  test("keeps the parts inside the range, prorating weight and runs", () => {
    const episodes: Episode[] = [
      { kind: "ok", startedAt: 0, endedAt: 100, runs: 10, weightedMs: 100 },
      {
        kind: "error",
        startedAt: 100,
        endedAt: 200,
        runs: 10,
        weightedMs: 100,
      },
    ];
    expect(clipEpisodes(episodes, 50, 150)).toEqual([
      { kind: "ok", startedAt: 50, endedAt: 100, runs: 5, weightedMs: 50 },
      { kind: "error", startedAt: 100, endedAt: 150, runs: 5, weightedMs: 50 },
    ]);
    expect(clipEpisodes(episodes, 150, 150)).toEqual([]);
  });
});
