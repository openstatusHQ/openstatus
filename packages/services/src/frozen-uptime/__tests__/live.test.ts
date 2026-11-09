import { describe, expect, test } from "vitest";

import type { ComputeCountRow } from "../compute";
import { fetchLiveDays } from "../live";
import type { StatusPipeFn, UptimeFreezePipes, UptimeRunsPipes } from "../run";

type Call = Parameters<StatusPipeFn>[0];
type Impl = () => Promise<{ data: ComputeCountRow[] }>;

function recording(impl: Impl): { pipe: StatusPipeFn; calls: Call[] } {
  const calls: Call[] = [];
  const pipe: StatusPipeFn = (params) => {
    calls.push(params);
    return impl();
  };
  return { pipe, calls };
}

function pipes(impl: Impl): { pipes: UptimeFreezePipes; calls: Call[] } {
  const { pipe, calls } = recording(impl);
  return {
    pipes: {
      http: pipe,
      tcp: pipe,
      dns: pipe,
      icmp: pipe,
      grpc: pipe,
      heartbeat: pipe,
    },
    calls,
  };
}

function runsPipes(impl: Impl): { pipes: UptimeRunsPipes; calls: Call[] } {
  const { pipe, calls } = recording(impl);
  return {
    pipes: { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe },
    calls,
  };
}

function row(overrides: Partial<ComputeCountRow>): ComputeCountRow {
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

describe("fetchLiveDays", () => {
  test("keys requests and runs by monitor and day", async () => {
    const { pipes: livePipes } = pipes(async () => ({
      data: [row({ ok: 60, error: 2 }), row({ ok: 30, degraded: 1 })],
    }));
    const { pipes: liveRunsPipes } = runsPipes(async () => ({
      data: [row({ ok: 10, error: 2 })],
    }));
    const { days, failedMonitorIds } = await fetchLiveDays({
      monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
      pipes: livePipes,
      runsPipes: liveRunsPipes,
    });
    expect(failedMonitorIds.size).toBe(0);
    expect(days.get("1")?.get("2026-11-02")).toEqual({
      day: "2026-11-02",
      requests: { ok: 90, degraded: 1, error: 2 },
      runs: { ok: 10, degraded: 0, error: 2 },
    });
  });

  test("asks for runs only for monitors with cloud regions", async () => {
    const { pipes: livePipes } = pipes(async () => ({ data: [] }));
    const { pipes: liveRunsPipes, calls } = runsPipes(async () => ({
      data: [],
    }));
    await fetchLiveDays({
      monitors: [
        { id: 1, jobType: "http", regions: sixRegions },
        { id: 2, jobType: "http", regions: "" },
        { id: 3, jobType: "heartbeat", regions: sixRegions },
      ],
      pipes: livePipes,
      runsPipes: liveRunsPipes,
    });
    expect(calls).toEqual([{ monitorIds: ["1"] }]);
  });

  test("skips the runs read without runs pipes", async () => {
    const { pipes: livePipes } = pipes(async () => ({ data: [row({})] }));
    const { days } = await fetchLiveDays({
      monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
      pipes: livePipes,
    });
    expect(days.get("1")?.get("2026-11-02")).toEqual({
      day: "2026-11-02",
      requests: { ok: 1, degraded: 0, error: 0 },
    });
  });

  test("a failed runs read keeps requests and never throws", async () => {
    const { pipes: livePipes } = pipes(async () => ({ data: [row({})] }));
    const { pipes: liveRunsPipes } = runsPipes(async () => {
      throw new Error("tinybird 500");
    });
    const { days, failedMonitorIds, failedRunsMonitorIds } =
      await fetchLiveDays({
        monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
        pipes: livePipes,
        runsPipes: liveRunsPipes,
        sleep,
      });
    expect(failedMonitorIds.size).toBe(0);
    expect(failedRunsMonitorIds).toEqual(new Set(["1"]));
    expect(days.get("1")?.get("2026-11-02")).toEqual({
      day: "2026-11-02",
      requests: { ok: 1, degraded: 0, error: 0 },
    });
  });

  test("a failed counts read marks the monitor failed", async () => {
    const { pipes: livePipes } = pipes(async () => {
      throw new Error("tinybird 500");
    });
    const { pipes: liveRunsPipes } = runsPipes(async () => ({
      data: [row({})],
    }));
    const { days, failedMonitorIds } = await fetchLiveDays({
      monitors: [{ id: 1, jobType: "http", regions: sixRegions }],
      pipes: livePipes,
      runsPipes: liveRunsPipes,
      sleep,
    });
    expect(failedMonitorIds).toEqual(new Set(["1"]));
    expect(days.has("1")).toBe(false);
  });
});
