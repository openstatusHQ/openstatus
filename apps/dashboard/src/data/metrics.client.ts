"use client";

import { MetricCard } from "@/components/metric/metric-card";
import { RouterOutputs } from "@openstatus/api";

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

// RENAME: mapUptime
export function mapStatus(status: RouterOutputs["tinybird"]["status"]) {
  return status.data
    .map((status) => {
      return {
        timestamp: new Date(status.day).toLocaleString("default", {
          day: "numeric",
          month: "short",
          // hour: "numeric",
          // minute: "numeric",
        }),
        ok: status.ok,
        degraded: 0, // status.degraded,
        error: status.count - status.ok,
      };
    })
    .reverse();
}
