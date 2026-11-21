import { describe, expect, test } from "vitest";

import type { GetMonitorLatencySeriesResult } from "../../monitor";
import {
  MAX_CHART_REGIONS,
  summarizeMonitorChart,
  toMonitorChartModel,
} from "../monitor-chart";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 8, 8, 20);

function point(region: string, hour: number, p95: number | null) {
  return {
    region,
    timestamp: T0 + hour * HOUR,
    p50: p95 === null ? null : Math.round(p95 / 2),
    p75: p95 === null ? null : Math.round(p95 * 0.7),
    p90: p95 === null ? null : Math.round(p95 * 0.9),
    p95,
    p99: p95 === null ? null : p95 + 100,
  };
}

function series(
  points: GetMonitorLatencySeriesResult["points"],
): GetMonitorLatencySeriesResult {
  return {
    monitorId: 42,
    name: "API",
    jobType: "http",
    timeRange: "1d",
    interval: 60,
    regions: [...new Set(points.map((p) => p.region))].sort(),
    points,
  };
}

describe("toMonitorChartModel", () => {
  test("the largest response the tool can produce stays a few kilobytes", () => {
    // 7d at 4h and 14d at 8h are both 42 buckets; a monitor can run in far more
    // than the six regions that get plotted.
    const regions = Array.from({ length: 30 }, (_, i) => `region-${i}`);
    const points = regions.flatMap((region, r) =>
      Array.from({ length: 43 }, (_, bucket) =>
        point(region, bucket * 8, 10_000 + r * 100 + bucket),
      ),
    );
    const model = toMonitorChartModel(
      { ...series(points), timeRange: "14d", interval: 480 },
      "p99",
    );
    expect(model.series).toHaveLength(MAX_CHART_REGIONS);
    const bytes =
      JSON.stringify(model).length + summarizeMonitorChart(model).length;
    expect(bytes).toBeLessThan(5_000);
  });

  test("pivots rows into series aligned with the timestamps", () => {
    const model = toMonitorChartModel(
      series([
        point("iad", 0, 200),
        point("fra", 0, 300),
        point("fra", 1, 911),
        point("iad", 2, 250),
      ]),
      "p95",
    );
    expect(model.timestamps).toEqual([T0, T0 + HOUR, T0 + 2 * HOUR]);
    expect(model.series).toEqual([
      { region: "fra", values: [300, 911, null] },
      { region: "iad", values: [200, null, 250] },
    ]);
    expect(model.peak).toEqual({
      region: "fra",
      value: 911,
      timestamp: T0 + HOUR,
    });
    expect(model.dashboardUrl).toMatch(/\/monitors\/42\/overview$/);
  });

  test("plots the requested percentile", () => {
    const model = toMonitorChartModel(series([point("fra", 0, 300)]), "p99");
    expect(model.series[0]?.values).toEqual([400]);
  });

  test("keeps the slowest regions and names the rest", () => {
    const regions = ["ams", "fra", "gru", "hkg", "iad", "jnb", "lax", "syd"];
    const model = toMonitorChartModel(
      series(regions.map((region, i) => point(region, 0, 100 * (i + 1)))),
      "p95",
    );
    expect(model.series).toHaveLength(MAX_CHART_REGIONS);
    expect(model.series.map((s) => s.region)).toEqual([
      "gru",
      "hkg",
      "iad",
      "jnb",
      "lax",
      "syd",
    ]);
    expect(model.omittedRegions).toEqual(["ams", "fra"]);
  });

  test("an empty window has no peak and still summarizes", () => {
    const model = toMonitorChartModel(series([]), "p95");
    expect(model.peak).toBeNull();
    expect(model.series).toEqual([]);
    expect(summarizeMonitorChart(model)).toContain("No checks recorded");
  });

  test("checks without latency are an outage, not an empty window", () => {
    const model = toMonitorChartModel(
      series([point("fra", 0, null), point("iad", 0, null)]),
      "p95",
    );
    expect(model.peak).toBeNull();
    expect(model.timestamps).toHaveLength(1);
    const text = summarizeMonitorChart(model);
    expect(text).toContain("none recorded a latency");
    expect(text).not.toContain("No checks recorded");
  });

  test("a region with no latency is ranked after every region with some", () => {
    const regions = ["ams", "fra", "gru", "hkg", "iad", "jnb"];
    const model = toMonitorChartModel(
      series([
        ...regions.map((region) => point(region, 0, 100)),
        point("syd", 0, null),
      ]),
      "p95",
    );
    expect(model.omittedRegions).toEqual(["syd"]);
  });
});

describe("summarizeMonitorChart", () => {
  test("carries the numbers a host without MCP Apps needs", () => {
    const text = summarizeMonitorChart(
      toMonitorChartModel(
        series([
          point("fra", 0, 300),
          point("fra", 1, 900),
          point("iad", 0, 200),
        ]),
        "p95",
      ),
    );
    expect(text).toContain(
      'p95 latency for "API" over the last 1d (1h buckets).',
    );
    expect(text).toContain("Peak: 900 ms in fra at 2026-09-08T21:00:00.000Z.");
    expect(text).toContain("Mean by region: fra 600 ms, iad 200 ms.");
  });

  test("names a region with no latency instead of calling it 0 ms", () => {
    const text = summarizeMonitorChart(
      toMonitorChartModel(
        series([point("fra", 0, 300), point("iad", 0, null)]),
        "p95",
      ),
    );
    expect(text).toContain(
      "Mean by region: fra 300 ms, iad no latency recorded.",
    );
  });
});
