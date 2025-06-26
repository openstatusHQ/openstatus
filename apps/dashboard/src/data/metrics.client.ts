"use client";

import type { Region } from "./regions";
import type { RegionMetric } from "./region-metrics";
import { MetricCard } from "@/components/metric/metric-card";
import { RouterOutputs } from "@openstatus/api";
import { flyRegions } from "@openstatus/db/src/schema/constants";

export const STATUS = ["success", "error", "degraded"] as const;
export const PERIODS = ["1d", "7d", "14d"] as const;
export const REGIONS = flyRegions as unknown as (typeof flyRegions)[number][];

// FIXME: rename pipe return values

export function mapMetrics(metrics: RouterOutputs["tinybird"]["metrics"]) {
  return metrics.data?.map((metric) => {
    return {
      p50: metric.p50Latency,
      p75: metric.p75Latency,
      p90: metric.p90Latency,
      p95: metric.p95Latency,
      p99: metric.p99Latency,
      // TODO: rename
      total: metric.count,
      uptime: metric.ok / metric.count,
      degraded: 0, // metric.degraded,
      error: metric.count - metric.ok,
    };
  });
}

export const variants = {
  uptime: "success",
  degraded: "warning",
  error: "destructive",
  total: "default",
  p50: "default",
  p75: "default",
  p90: "default",
  p95: "default",
  p99: "default",
} as const satisfies Record<
  keyof ReturnType<typeof mapMetrics>[number],
  React.ComponentProps<typeof MetricCard>["variant"]
>;

export function mapUptime(status: RouterOutputs["tinybird"]["uptime"]) {
  return status.data
    .map((status) => {
      return {
        ...status,
        ok: status.success,
        interval: status.interval.toLocaleString("default", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "numeric",
        }),
        total: status.success + status.error + status.degraded,
      };
    })
    .reverse();
}

/**
 * Transform Tinybird `metricsRegions` response into RegionMetric[] for UI.
 */
export function mapRegionMetrics(
  timeline: RouterOutputs["tinybird"]["metricsRegions"] | undefined,
  regions: Region[]
): RegionMetric[] {
  if (!timeline)
    return (regions
      .sort((a, b) => a.localeCompare(b))
      .map((region) => ({
        region,
        p50: 0,
        p90: 0,
        p99: 0,
        trend: [] as { latency: number; timestamp: number }[],
      })) ?? []) as RegionMetric[];

  type TimelineRow = (typeof timeline.data)[number];

  const map = new Map<
    Region,
    {
      region: Region;
      p50: number;
      p90: number;
      p99: number;
      trend: { latency: number; timestamp: number }[];
    }
  >();

  (timeline.data as TimelineRow[])
    .filter((row) => regions.includes(row.region as Region))
    .sort((a, b) => a.region.localeCompare(b.region))
    .forEach((row) => {
      const region = row.region as Region;
      const entry = map.get(region) ?? {
        region,
        p50: 0,
        p90: 0,
        p99: 0,
        trend: [],
      };

      entry.trend.push({
        latency: row.p50Latency ?? 0,
        timestamp: row.timestamp,
      });

      entry.p50 += row.p50Latency ?? 0;
      entry.p90 += row.p90Latency ?? 0;
      entry.p99 += row.p99Latency ?? 0;

      map.set(region, entry);
    });

  map.forEach((entry) => {
    const count = entry.trend.length || 1;
    entry.p50 = Math.round(entry.p50 / count);
    entry.p90 = Math.round(entry.p90 / count);
    entry.p99 = Math.round(entry.p99 / count);
  });

  return Array.from(map.values()) as RegionMetric[];
}
