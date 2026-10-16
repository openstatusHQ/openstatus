import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  getMonitorListMetrics,
  getRegionAxisMax,
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
    expect(mapRegionMetrics(undefined, ["iad", "ams"])).toEqual([
      { region: "ams", p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, buckets: 0 },
      { region: "iad", p50: 0, p75: 0, p90: 0, p95: 0, p99: 0, buckets: 0 },
    ]);
  });

  it("keeps requested regions without data", () => {
    const timeline = {
      data: [row("iad", 1, 10, 20)],
    } as unknown as Timeline;
    const result = mapRegionMetrics(timeline, ["iad", "fra"]);
    expect(result.map((r) => [r.region, r.buckets])).toEqual([
      ["fra", 0],
      ["iad", 1],
    ]);
  });

  it("averages percentiles per region", () => {
    const timeline = {
      data: [
        row("iad", 2, 100, 300),
        row("iad", 1, 201, 400),
        row("ams", 2, 50, 60),
        row("fra", 2, 999, 999),
      ],
    } as unknown as Timeline;

    const result = mapRegionMetrics(timeline, ["ams", "iad"]);
    expect(result.map((r) => r.region)).toEqual(["ams", "iad"]);

    const iad = result[1];
    expect(iad.p50).toBe(151);
    expect(iad.p99).toBe(350);
  });

  it("treats missing percentile values as 0", () => {
    const timeline = {
      data: [row("ams", 1, 10, 20)],
    } as unknown as Timeline;
    expect(mapRegionMetrics(timeline, ["ams"])[0].p75).toBe(0);
  });
});

describe("getRegionAxisMax", () => {
  function metric(p90: number, p99: number, buckets = 1) {
    return { region: "x", p50: 0, p75: 0, p90, p95: 0, p99, buckets };
  }

  it("rounds the largest P99 up", () => {
    expect(getRegionAxisMax([metric(192, 301), metric(410, 556)])).toBe(600);
  });

  it("clips an outlier P99 but keeps every P90", () => {
    expect(
      getRegionAxisMax([metric(192, 301), metric(410, 1240), metric(177, 254)]),
    ).toBe(500);
  });

  it("ignores regions without data", () => {
    expect(getRegionAxisMax([metric(0, 0, 0)])).toBe(100);
    expect(getRegionAxisMax([metric(50, 80), metric(0, 9000, 0)])).toBe(80);
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
