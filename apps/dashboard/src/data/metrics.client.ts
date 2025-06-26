"use client";

import type { Region } from "./regions";
import type { RegionMetric } from "./region-metrics";
import { MetricCard } from "@/components/metric/metric-card";
import { RouterOutputs } from "@openstatus/api";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { formatMilliseconds } from "@/lib/formatter";

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

export function mapGlobalMetrics(
  metrics: RouterOutputs["tinybird"]["globalMetrics"]
) {
  return metrics.data?.map((metric) => {
    return {
      p50: metric.p50Latency,
      p75: metric.p75Latency,
      p90: metric.p90Latency,
      p95: metric.p95Latency,
      p99: metric.p99Latency,
      total: metric.count,
      monitorId: metric.monitorId,
    };
  });
}

export type MonitorListMetric = {
  title: string;
  key: "degraded" | "error" | "active" | "inactive" | "p95";
  value: number | string;
  variant: React.ComponentProps<typeof MetricCard>["variant"];
};

export const globalCards = [
  "active",
  "degraded",
  "error",
  "inactive",
  "p95",
] as const;

export const metricsGlobalCards: Record<
  (typeof globalCards)[number],
  {
    title: string;
    key: (typeof globalCards)[number];
  }
> = {
  active: {
    title: "Normal",
    key: "active" as const,
  },
  degraded: {
    title: "Degraded",
    key: "degraded" as const,
  },
  error: {
    title: "Failing",
    key: "error" as const,
  },
  inactive: {
    title: "Inactive",
    key: "inactive" as const,
  },
  p95: {
    title: "Slowest P95",
    key: "p95" as const,
  },
};

/**
 * Build the metric cards data that is shown on the monitors list page.
 */
export function getMonitorListMetrics(
  monitors: RouterOutputs["monitor"]["list"] = [],
  data: {
    p95Latency: number;
    monitorId: string;
  }[] = []
): readonly MonitorListMetric[] {
  const variantMap: Record<
    (typeof globalCards)[number],
    React.ComponentProps<typeof MetricCard>["variant"]
  > = {
    active: "success",
    degraded: "warning",
    error: "destructive",
    inactive: "default",
    p95: "ghost",
  } as const;

  return globalCards.map((key) => {
    let value: number | string = 0;
    switch (key) {
      case "active":
        value = monitors.filter(
          (m) => m.status === "active" && m.active
        ).length;
        break;
      case "degraded":
        value = monitors.filter(
          (m) => m.status === "degraded" && m.active
        ).length;
        break;
      case "error":
        value = monitors.filter((m) => m.status === "error" && m.active).length;
        break;
      case "inactive":
        value = monitors.filter((m) => m.active === false).length;
        break;
      case "p95":
        value = formatMilliseconds(
          data.sort((a, b) => b.p95Latency - a.p95Latency)[0]?.p95Latency ?? 0
        );
        break;
    }

    return {
      title: metricsGlobalCards[key].title,
      key,
      value,
      variant: variantMap[key],
    } as const;
  }) as readonly MonitorListMetric[];
}
