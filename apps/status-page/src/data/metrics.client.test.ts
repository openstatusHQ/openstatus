import type { RouterOutputs } from "@openstatus/api";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  getMonitorListMetrics,
  latencyByMonitorId,
  mapMetrics,
  mapRegionMetrics,
} from "./metrics.client";

type MetricsRegions = RouterOutputs["tinybird"]["metricsRegions"];
type Monitors = RouterOutputs["monitor"]["list"];
type PageMonitors = RouterOutputs["statusPage"]["getMonitors"];

// safe because each helper reads only the fields these fixtures set
function asType<T>(value: unknown): T {
  return value as T;
}

describe("mapMetrics", () => {
  test("counts degraded checks as up", () => {
    const [row] = mapMetrics(
      asType({
        data: [
          {
            p50Latency: 1,
            p75Latency: 2,
            p90Latency: 3,
            p95Latency: 4,
            p99Latency: 5,
            count: 10,
            success: 7,
            degraded: 1,
            error: 2,
            lastTimestamp: 0,
          },
        ],
      }),
    );
    expect(row.uptime).toBe(0.8);
    expect(row.total).toBe(10);
    expect(row.p95).toBe(4);
  });
});

describe("mapRegionMetrics", () => {
  test("returns zeroed, sorted regions without a timeline", () => {
    expect(mapRegionMetrics(undefined, ["fra", "ams"], "p50")).toEqual([
      { region: "ams", p50: 0, p90: 0, p99: 0, trend: [] },
      { region: "fra", p50: 0, p90: 0, p99: 0, trend: [] },
    ]);
  });

  test("averages percentiles per region and keeps only requested regions", () => {
    const timeline = asType<MetricsRegions>({
      data: [
        {
          region: "fra",
          timestamp: 2,
          p50Latency: 100,
          p90Latency: 200,
          p99Latency: 300,
          p75Latency: 150,
        },
        {
          region: "fra",
          timestamp: 1,
          p50Latency: 201,
          p90Latency: 400,
          p99Latency: 600,
          p75Latency: 250,
        },
        {
          region: "ams",
          timestamp: 1,
          p50Latency: 50,
          p90Latency: null,
          p99Latency: 70,
          p75Latency: 60,
        },
        {
          region: "iad",
          timestamp: 1,
          p50Latency: 999,
          p90Latency: 999,
          p99Latency: 999,
          p75Latency: 999,
        },
      ],
    });
    const result = mapRegionMetrics(timeline, ["ams", "fra"], "p75");
    expect(result.map((r) => r.region)).toEqual(["ams", "fra"]);
    expect(result[0]).toMatchObject({ p50: 50, p90: 0, p99: 70 });
    expect(result[1]).toMatchObject({ p50: 151, p90: 300, p99: 450 });
    expect(result[1].trend).toEqual([
      { latency: 250, timestamp: 1, fra: 250 },
      { latency: 150, timestamp: 2, fra: 150 },
    ]);
  });
});

describe("getMonitorListMetrics", () => {
  const monitors = asType<Monitors>([
    { status: "active", active: true },
    { status: "active", active: false },
    { status: "degraded", active: true },
    { status: "error", active: true },
    { status: "error", active: false },
  ]);

  test("counts active monitors by status and inactive ones separately", () => {
    const values = Object.fromEntries(
      getMonitorListMetrics(monitors).map((m) => [m.key, m.value]),
    );
    expect(values).toEqual({
      active: 1,
      degraded: 1,
      error: 1,
      inactive: 2,
      p95: "N/A",
    });
  });

  test("shows the slowest p95", () => {
    const p95 = getMonitorListMetrics(monitors, [
      { monitorId: "1", p95Latency: 120 },
      { monitorId: "2", p95Latency: 1500 },
    ]).find((m) => m.key === "p95");
    expect(p95?.value).toBe("1.5 sec");
  });
});

describe("latencyByMonitorId", () => {
  test("averages the percentile and compacts the unit", () => {
    const map = latencyByMonitorId(
      asType<PageMonitors>([
        {
          id: 1,
          data: [
            { p75Latency: 100 },
            { p75Latency: 133 },
            { p75Latency: null },
          ],
        },
        { id: 2, data: [] },
        { id: 3, data: [{ p75Latency: 2500 }] },
      ]),
    );
    expect(map.get("1")).toBe("117ms");
    expect(map.has("2")).toBe(false);
    expect(map.get("3")).toBe("2.5sec");
  });

  test("uses the requested percentile", () => {
    const map = latencyByMonitorId(
      asType<PageMonitors>([
        { id: 1, data: [{ p75Latency: 1, p99Latency: 900 }] },
      ]),
      "p99",
    );
    expect(map.get("1")).toBe("900ms");
  });
});
