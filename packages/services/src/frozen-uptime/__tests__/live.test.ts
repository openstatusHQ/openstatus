import { describe, expect, test } from "vitest";

import { tallyDay } from "../../status-timeline";
import {
  attachRuns,
  fetchIntervalRuns,
  fetchLiveRuns,
  toIntervalCounts,
} from "../live";
import type { QuorumHistogramRow, QuorumIntervalRow } from "../quorum";
import type {
  QuorumIntervalPipeFn,
  QuorumPipeFn,
  UptimeQuorumIntervalPipes,
  UptimeQuorumPipes,
} from "../run";

type Call = { monitorIds: string[]; timezone?: string };

function pipes(
  impl: (params: Call) => Promise<{ data: QuorumHistogramRow[] }>,
): { pipes: UptimeQuorumPipes; calls: Call[] } {
  const calls: Call[] = [];
  const pipe: QuorumPipeFn = (params) => {
    calls.push(params);
    return impl(params);
  };
  return {
    pipes: { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe },
    calls,
  };
}

function hist(overrides: Partial<QuorumHistogramRow>): QuorumHistogramRow {
  return {
    monitorId: "1",
    day: "2026-11-02T00:00:00.000Z",
    errorRegions: 0,
    degradedOrErrorRegions: 0,
    runs: 1,
    ...overrides,
  };
}

const sixRegions = "ams,fra,iad,gru,syd,hkg";
const sleep = async () => {};

describe("fetchLiveRuns", () => {
  test("a UTC read sends the freeze's request shape, without a timezone", async () => {
    const { pipes: quorumPipes, calls } = pipes(async () => ({ data: [] }));
    for (const timeZone of [undefined, "UTC"]) {
      await fetchLiveRuns({
        monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
        quorumPipes,
        timeZone,
      });
    }
    expect(calls).toEqual([{ monitorIds: ["1"] }, { monitorIds: ["1"] }]);
    for (const call of calls)
      expect(Object.hasOwn(call, "timezone")).toBe(false);
  });

  test("a zoned read passes the zone and keys the local days it returns", async () => {
    const { pipes: quorumPipes, calls } = pipes(async () => ({
      data: [
        hist({ day: "2026-11-03T00:00:00.000Z", errorRegions: 1, runs: 10 }),
      ],
    }));
    const quorum = await fetchLiveRuns({
      monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
      quorumPipes,
      timeZone: "Europe/Berlin",
    });
    expect(calls).toEqual([{ monitorIds: ["1"], timezone: "Europe/Berlin" }]);
    expect(quorum.get("1")?.get("2026-11-03")).toEqual({
      ok: 10,
      degraded: 0,
      error: 0,
    });
  });

  test("private-only and heartbeat monitors are never fetched", async () => {
    const { pipes: quorumPipes, calls } = pipes(async () => ({ data: [] }));
    const quorum = await fetchLiveRuns({
      monitors: [
        { id: 1, jobType: "http", regions: "" },
        { id: 2, jobType: "heartbeat", regions: "" },
      ],
      quorumPipes,
    });
    expect(calls).toEqual([]);
    expect(quorum.size).toBe(0);
  });

  test("a failed histogram leaves the monitor out and never throws", async () => {
    const { pipes: quorumPipes } = pipes(async ({ monitorIds }) => {
      if (monitorIds.includes("1")) throw new Error("tinybird 500");
      return { data: [hist({ monitorId: "2" })] };
    });
    const quorum = await fetchLiveRuns({
      monitors: [
        { id: 1, jobType: "http", regions: sixRegions },
        { id: 2, jobType: "tcp", regions: sixRegions },
      ],
      quorumPipes,
      attempts: 1,
      sleep,
    });
    expect(quorum.has("1")).toBe(false);
    expect(quorum.get("2")?.has("2026-11-02")).toBe(true);
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

type IntervalCall = Parameters<QuorumIntervalPipeFn>[0];

function intervalPipes(
  impl: (params: IntervalCall) => Promise<{ data: QuorumIntervalRow[] }>,
): { pipes: UptimeQuorumIntervalPipes; calls: IntervalCall[] } {
  const calls: IntervalCall[] = [];
  const pipe: QuorumIntervalPipeFn = (params) => {
    calls.push(params);
    return impl(params);
  };
  return {
    pipes: { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe },
    calls,
  };
}

// both sides parse Tinybird's `interval` string with z.coerce.date()
const bucketA = new Date("2026-11-08 08:00:00");
const bucketB = new Date("2026-11-08 12:00:00");

function intervalRow(overrides: Partial<QuorumIntervalRow>): QuorumIntervalRow {
  return {
    interval: bucketA,
    errorRegions: 0,
    degradedOrErrorRegions: 0,
    runs: 1,
    ...overrides,
  };
}

const window = {
  interval: 240,
  fromDate: "2026-11-01T00:00:00.000Z",
  toDate: "2026-11-08T23:59:59.999Z",
};

describe("fetchIntervalRuns", () => {
  test("asks for the uptime window and keys buckets by interval start", async () => {
    const { pipes: quorumPipes, calls } = intervalPipes(async () => ({
      data: [
        intervalRow({ runs: 44 }),
        intervalRow({ errorRegions: 1, degradedOrErrorRegions: 1, runs: 4 }),
        intervalRow({ interval: bucketB, errorRegions: 3, runs: 2 }),
      ],
    }));
    const quorum = await fetchIntervalRuns({
      monitor: { id: 7, jobType: "tcp", regions: sixRegions },
      pipes: quorumPipes,
      ...window,
    });
    expect(calls).toEqual([{ monitorId: "7", ...window }]);
    expect(quorum?.get(bucketA.toISOString())).toEqual({
      ok: 48,
      degraded: 0,
      error: 0,
    });
    expect(quorum?.get(bucketB.toISOString())).toEqual({
      ok: 0,
      degraded: 0,
      error: 2,
    });
  });

  test("an empty histogram yields no buckets", async () => {
    const { pipes: quorumPipes } = intervalPipes(async () => ({ data: [] }));
    const quorum = await fetchIntervalRuns({
      monitor: { id: 1, jobType: "http", regions: sixRegions },
      pipes: quorumPipes,
      ...window,
    });
    expect(quorum).toEqual(new Map());
  });

  test("private-only, heartbeat and udp monitors are never asked", async () => {
    const { pipes: quorumPipes, calls } = intervalPipes(async () => ({
      data: [],
    }));
    for (const monitor of [
      { id: 1, jobType: "http", regions: "" },
      { id: 2, jobType: "heartbeat", regions: "" },
      { id: 3, jobType: "udp", regions: sixRegions },
    ]) {
      expect(
        await fetchIntervalRuns({ monitor, pipes: quorumPipes, ...window }),
      ).toBeNull();
    }
    expect(calls).toEqual([]);
  });

  test("a failed read rejects, for the caller's fallback to catch", async () => {
    const { pipes: quorumPipes } = intervalPipes(async () => {
      throw new Error("tinybird 500");
    });
    await expect(
      fetchIntervalRuns({
        monitor: { id: 1, jobType: "http", regions: sixRegions },
        pipes: quorumPipes,
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
