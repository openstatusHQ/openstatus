import { describe, expect, test } from "vitest";

import { tallyDay } from "../../status-timeline";
import type { ComputeCountRow } from "../compute";
import {
  attachRuns,
  fetchIntervalRuns,
  fetchLiveRuns,
  type IntervalPipeFn,
  toIntervalCounts,
} from "../live";
import type { StatusPipeFn, UptimeRunsPipes } from "../run";

type Call = Parameters<StatusPipeFn>[0];

function pipes(impl: (params: Call) => Promise<{ data: ComputeCountRow[] }>): {
  pipes: UptimeRunsPipes;
  calls: Call[];
} {
  const calls: Call[] = [];
  const pipe: StatusPipeFn = (params) => {
    calls.push(params);
    return impl(params);
  };
  return {
    pipes: { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe },
    calls,
  };
}

function runRow(overrides: Partial<ComputeCountRow>): ComputeCountRow {
  return {
    monitorId: "1",
    day: "2026-11-02T00:00:00.000Z",
    ok: 1,
    degraded: 0,
    error: 0,
    ...overrides,
  };
}

const sixRegions = "ams,fra,iad,gru,syd,hkg";
const sleep = async () => {};

describe("fetchLiveRuns", () => {
  test("asks each job type's pipe for runs with region counts aligned to monitorIds", async () => {
    const { pipes: runsPipes, calls } = pipes(async () => ({ data: [] }));
    await fetchLiveRuns({
      monitors: [
        { id: 3, jobType: "http", regions: sixRegions },
        { id: 1, jobType: "http", regions: "ams,fra" },
        { id: 2, jobType: "tcp", regions: "ams,fra,iad" },
      ],
      pipes: runsPipes,
    });
    expect(calls).toEqual([
      { monitorIds: ["3", "1"], type: "runs", regionCounts: [6, 2] },
      { monitorIds: ["2"], type: "runs", regionCounts: [3] },
    ]);
  });

  test("keys the judged rows by monitor and day", async () => {
    const { pipes: runsPipes } = pipes(async () => ({
      data: [runRow({ day: "2026-11-03T00:00:00.000Z", ok: 10, error: 2 })],
    }));
    const runs = await fetchLiveRuns({
      monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
      pipes: runsPipes,
    });
    expect(runs.get("1")?.get("2026-11-03")).toEqual({
      ok: 10,
      degraded: 0,
      error: 2,
    });
  });

  test("private-only and heartbeat monitors are never fetched", async () => {
    const { pipes: runsPipes, calls } = pipes(async () => ({ data: [] }));
    const runs = await fetchLiveRuns({
      monitors: [
        { id: 1, jobType: "http", regions: "" },
        { id: 2, jobType: "heartbeat", regions: sixRegions },
      ],
      pipes: runsPipes,
    });
    expect(calls).toEqual([]);
    expect(runs.size).toBe(0);
  });

  test("a failed read leaves the monitor out and never throws", async () => {
    const { pipes: runsPipes } = pipes(async ({ monitorIds }) => {
      if (monitorIds.includes("1")) throw new Error("tinybird 500");
      return { data: [runRow({ monitorId: "2" })] };
    });
    const runs = await fetchLiveRuns({
      monitors: [
        { id: 1, jobType: "http", regions: sixRegions },
        { id: 2, jobType: "tcp", regions: sixRegions },
      ],
      pipes: runsPipes,
      attempts: 1,
      sleep,
    });
    expect(runs.has("1")).toBe(false);
    expect(runs.get("2")?.has("2026-11-02")).toBe(true);
  });
});

describe("attachRuns", () => {
  const runs = { ok: 144, degraded: 0, error: 0 };
  const day = (monitorId: string, date: string, ok: number, error: number) => ({
    monitorId,
    day: `${date}T00:00:00.000Z`,
    requests: { ok, degraded: 0, error },
  });

  test("attaches by day key, leaves other days and monitors without runs", () => {
    const rows = new Map([
      ["1", [day("1", "2026-11-02", 720, 144), day("1", "2026-11-01", 864, 0)]],
      ["2", [day("2", "2026-11-02", 5, 1)]],
    ]);
    const out = attachRuns(
      rows,
      new Map([["1", new Map([["2026-11-02", runs]])]]),
    );
    expect(out.get("1")?.[0]?.runs).toEqual(runs);
    expect(out.get("1")?.[1]?.runs).toBeUndefined();
    expect(out.get("2")?.[0]?.runs).toBeUndefined();
    expect(rows.get("1")?.[0]).not.toHaveProperty("runs");
  });

  test("1 of 6 regions failing every run: the day is up and counted in runs", () => {
    const [attached] =
      attachRuns(
        new Map([["1", [day("1", "2026-11-02", 720, 144)]]]),
        new Map([["1", new Map([["2026-11-02", runs]])]]),
      ).get("1") ?? [];
    expect(attached && tallyDay(attached, 6)).toEqual({
      up: 144,
      total: 144,
      ok: 144,
      degraded: 0,
      error: 0,
      status: "success",
    });
  });
});

type IntervalCall = Parameters<IntervalPipeFn>[0];
type IntervalRow = Awaited<ReturnType<IntervalPipeFn>>["data"][number];

function intervalPipe(
  impl: (params: IntervalCall) => Promise<{ data: IntervalRow[] }>,
): { pipe: IntervalPipeFn; calls: IntervalCall[] } {
  const calls: IntervalCall[] = [];
  return {
    pipe: (params) => {
      calls.push(params);
      return impl(params);
    },
    calls,
  };
}

// both sides parse Tinybird's `interval` string with z.coerce.date()
const bucketA = new Date("2026-11-08 08:00:00");
const bucketB = new Date("2026-11-08 12:00:00");

const window = {
  interval: 240,
  fromDate: "2026-11-01T00:00:00.000Z",
  toDate: "2026-11-08T23:59:59.999Z",
};

describe("fetchIntervalRuns", () => {
  test("asks for runs over the uptime window and keys buckets by interval start", async () => {
    const { pipe, calls } = intervalPipe(async () => ({
      data: [
        { interval: bucketA, success: 48, degraded: 0, error: 0 },
        { interval: bucketB, success: 0, degraded: 0, error: 2 },
      ],
    }));
    const runs = await fetchIntervalRuns({
      monitor: { id: 7, jobType: "tcp", regions: sixRegions },
      pipe,
      ...window,
    });
    expect(calls).toEqual([
      { monitorId: "7", ...window, type: "runs", regionCount: 6 },
    ]);
    expect(runs?.get(bucketA.toISOString())).toEqual({
      ok: 48,
      degraded: 0,
      error: 0,
    });
    expect(runs?.get(bucketB.toISOString())).toEqual({
      ok: 0,
      degraded: 0,
      error: 2,
    });
  });

  test("an empty read yields no buckets", async () => {
    const { pipe } = intervalPipe(async () => ({ data: [] }));
    const runs = await fetchIntervalRuns({
      monitor: { id: 1, jobType: "http", regions: sixRegions },
      pipe,
      ...window,
    });
    expect(runs).toEqual(new Map());
  });

  test("private-only, heartbeat and udp monitors are never asked", async () => {
    const { pipe, calls } = intervalPipe(async () => ({ data: [] }));
    for (const monitor of [
      { id: 1, jobType: "http", regions: "" },
      { id: 2, jobType: "heartbeat", regions: "" },
      { id: 3, jobType: "udp", regions: sixRegions },
    ]) {
      expect(await fetchIntervalRuns({ monitor, pipe, ...window })).toBeNull();
    }
    expect(calls).toEqual([]);
  });

  test("a failed read rejects, for the caller's fallback to catch", async () => {
    const { pipe } = intervalPipe(async () => {
      throw new Error("tinybird 500");
    });
    await expect(
      fetchIntervalRuns({
        monitor: { id: 1, jobType: "http", regions: sixRegions },
        pipe,
        ...window,
      }),
    ).rejects.toThrow("tinybird 500");
  });
});

describe("toIntervalCounts", () => {
  const runs = { ok: 48, degraded: 0, error: 0 };
  const rows = [
    { interval: new Date(bucketA), success: 240, degraded: 0, error: 48 },
    { interval: new Date(bucketB), success: 288, degraded: 0, error: 0 },
  ];

  test("reads uptime rows as requests, with the runs of the same interval", () => {
    expect(
      toIntervalCounts(rows, new Map([[bucketA.toISOString(), runs]])),
    ).toEqual([
      {
        interval: bucketA,
        requests: { ok: 240, degraded: 0, error: 48 },
        runs,
      },
      { interval: bucketB, requests: { ok: 288, degraded: 0, error: 0 } },
    ]);
    expect(toIntervalCounts(rows, null)[0]).not.toHaveProperty("runs");
  });

  test("1 of 6 regions failing every run: the bucket is up in runs", () => {
    const [row] = toIntervalCounts(
      rows,
      new Map([[bucketA.toISOString(), runs]]),
    );
    expect(row && tallyDay(row, 6)).toMatchObject({
      up: 48,
      total: 48,
      error: 0,
    });
  });
});
