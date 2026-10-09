import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  getMonitorListMetrics,
  isPaidPeriod,
  mapMetrics,
  mapRegionMetrics,
} from "./metrics.client";

type Monitors = Parameters<typeof getMonitorListMetrics>[0];
type Metrics = Parameters<typeof mapMetrics>[0];
type Timeline = Parameters<typeof mapRegionMetrics>[0];

describe("isPaidPeriod", () => {
  it("gates only the long periods", () => {
    expect(isPaidPeriod("30d")).toBe(true);
    expect(isPaidPeriod("90d")).toBe(true);
    expect(isPaidPeriod("14d")).toBe(false);
    expect(isPaidPeriod("1d")).toBe(false);
  });
});

describe("mapMetrics", () => {
  it("counts degraded checks as up", () => {
    const [row] =
      mapMetrics({
        data: [
          {
            p50Latency: 1,
            p75Latency: 2,
            p90Latency: 3,
            p95Latency: 4,
            p99Latency: 5,
            count: 10,
            success: 7,
            degraded: 2,
            error: 1,
            lastTimestamp: 123,
          },
        ],
      } as unknown as Metrics) ?? [];
    expect(row).toEqual({
      p50: 1,
      p75: 2,
      p90: 3,
      p95: 4,
      p99: 5,
      total: 10,
      uptime: 0.9,
      degraded: 2,
      error: 1,
      lastTimestamp: 123,
    });
  });
});

describe("mapRegionMetrics", () => {
  function row(region: string, timestamp: number, p50: number, p99: number) {
    return {
      region,
      timestamp,
      p50Latency: p50,
      p75Latency: null,
      p90Latency: p50,
      p95Latency: null,
      p99Latency: p99,
    };
  }

  it("returns empty sorted entries without a timeline", () => {
    expect(mapRegionMetrics(undefined, ["iad", "ams"], "p50")).toEqual([
      { region: "ams", p50: 0, p90: 0, p99: 0, trend: [] },
      { region: "iad", p50: 0, p90: 0, p99: 0, trend: [] },
    ]);
  });

  it("averages percentiles and reverses the trend per region", () => {
    const timeline = {
      data: [
        row("iad", 2, 100, 300),
        row("iad", 1, 201, 400),
        row("ams", 2, 50, 60),
        row("fra", 2, 999, 999),
      ],
    } as unknown as Timeline;

    const result = mapRegionMetrics(timeline, ["ams", "iad"], "p99");
    expect(result.map((r) => r.region)).toEqual(["ams", "iad"]);

    const iad = result[1];
    expect(iad.p50).toBe(151);
    expect(iad.p99).toBe(350);
    expect(iad.trend).toEqual([
      { latency: 400, timestamp: 1, iad: 400 },
      { latency: 300, timestamp: 2, iad: 300 },
    ]);
  });

  it("treats missing percentile values as 0", () => {
    const timeline = {
      data: [row("ams", 1, 10, 20)],
    } as unknown as Timeline;
    expect(mapRegionMetrics(timeline, ["ams"], "p75")[0].trend).toEqual([
      { latency: 0, timestamp: 1, ams: 0 },
    ]);
  });
});

describe("getMonitorListMetrics", () => {
  const monitors = [
    { status: "active", active: true },
    { status: "active", active: true },
    { status: "degraded", active: true },
    { status: "error", active: true },
    { status: "error", active: false },
  ] as unknown as Monitors;

  it("counts active monitors per status and inactive ones separately", () => {
    const metrics = getMonitorListMetrics(monitors, [
      { monitorId: "1", p95Latency: 120 },
      { monitorId: "2", p95Latency: 1500 },
    ]);
    expect(
      metrics.map(({ key, value, variant }) => ({ key, value, variant })),
    ).toEqual([
      { key: "active", value: 2, variant: "success" },
      { key: "degraded", value: 1, variant: "warning" },
      { key: "error", value: 1, variant: "destructive" },
      { key: "inactive", value: 1, variant: "default" },
      { key: "p95", value: "1.5 sec", variant: "ghost" },
    ]);
  });

  it("shows N/A without latency data", () => {
    const p95 = getMonitorListMetrics().find((m) => m.key === "p95");
    expect(p95?.value).toBe("N/A");
  });
});
