import type { OSTinybird } from "@openstatus/tinybird";
import { describe, expect, test } from "vitest";

import {
  fetchRunCounts,
  type RunsRangePipeFn,
  type UptimeRunsRangePipes,
  uptimeRunsRangePipes,
} from "../run";

type Call = Parameters<RunsRangePipeFn>[0];

function pipes(impl: (call: Call) => ReturnType<RunsRangePipeFn>): {
  pipes: UptimeRunsRangePipes;
  calls: Call[];
} {
  const calls: Call[] = [];
  const pipe: RunsRangePipeFn = (params) => {
    calls.push(params);
    return impl(params);
  };
  return {
    pipes: { http: pipe, tcp: pipe, dns: pipe, icmp: pipe, grpc: pipe },
    calls,
  };
}

const from = new Date("2026-10-01T00:00:00.000Z");
const to = new Date("2026-11-01T00:00:00.000Z");
const noSleep = async () => {};

describe("uptimeRunsRangePipes", () => {
  test("covers every job type with cloud regions", () => {
    // safe because uptimeRunsRangePipes only reads pipe getters off the client
    const tb = new Proxy({}, { get: (_, key) => String(key) }) as OSTinybird;

    expect(uptimeRunsRangePipes(tb)).toEqual({
      http: "httpRunsRange",
      tcp: "tcpRunsRange",
      dns: "dnsRunsRange",
      icmp: "icmpRunsRange",
      grpc: "grpcRunsRange",
    });
  });
});

describe("fetchRunCounts", () => {
  test("sends the range as epoch ms and sums rows per monitor", async () => {
    const { pipes: p, calls } = pipes(async () => ({
      data: [
        { monitorId: "1", count: 10, ok: 8, degraded: 1, error: 1 },
        { monitorId: "1", count: 2, ok: 2, degraded: 0, error: 0 },
        { monitorId: "2", count: 0, ok: 0, degraded: 0, error: 0 },
      ],
    }));

    const res = await fetchRunCounts({
      monitors: [
        { id: 1, jobType: "http", regions: "ams,fra" },
        { id: 2, jobType: "http", regions: "ams" },
      ],
      pipes: p,
      from,
      to,
      sleep: noSleep,
    });

    expect(calls).toEqual([
      {
        monitorIds: ["1", "2"],
        fromDate: from.getTime(),
        toDate: to.getTime(),
      },
    ]);
    expect(res.counts).toEqual(
      new Map([["1", { ok: 10, degraded: 1, error: 1 }]]),
    );
    expect(res.failedMonitorIds).toEqual(new Set());
  });

  test("never asks for monitors without run verdicts", async () => {
    const { pipes: p, calls } = pipes(async () => ({ data: [] }));

    await fetchRunCounts({
      monitors: [
        { id: 1, jobType: "heartbeat", regions: "" },
        { id: 2, jobType: "http", regions: "" },
        { id: 3, jobType: "udp", regions: "ams" },
      ],
      pipes: p,
      from,
      to,
      sleep: noSleep,
    });

    expect(calls).toEqual([]);
  });

  test("an endpoint that is not deployed yet fails its monitors without throwing", async () => {
    const { pipes: p } = pipes(async () => {
      throw new Error("404: pipe not found");
    });

    const res = await fetchRunCounts({
      monitors: [{ id: 1, jobType: "tcp", regions: "ams" }],
      pipes: p,
      from,
      to,
      sleep: noSleep,
    });

    expect(res.counts).toEqual(new Map());
    expect(res.failedMonitorIds).toEqual(new Set(["1"]));
  });
});
