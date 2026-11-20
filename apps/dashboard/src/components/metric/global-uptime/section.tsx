"use client";

import type { RouterOutputs } from "@openstatus/api";
import { formatDistanceToNowStrict } from "date-fns";

import {
  type MetricStatus,
  MetricStrip,
  MetricStripBadge,
  MetricStripItem,
  MetricStripLabel,
  MetricStripRow,
  MetricStripSkeleton,
  MetricStripUnit,
  MetricStripValue,
} from "@/components/metric/metric-strip";
import {
  hasMetricsData,
  mapMetrics,
  metricsCards,
} from "@/data/metrics.client";
import {
  formatMilliseconds,
  formatNumber,
  formatPercentage,
  splitUnit,
} from "@/lib/formatter";

type Metric = {
  label: string;
  value: string;
  trend?: number | null;
  status: MetricStatus | undefined;
};

const ROWS = [
  {
    label: "Checks",
    keys: ["uptime", "degraded", "error", "total", "lastTimestamp"],
  },
  { label: "Latency", keys: ["p50", "p75", "p90", "p95", "p99"] },
] as const;

type MetricKey = (typeof ROWS)[number]["keys"][number];

// TODO: missing dynamic degraded

export function GlobalUptimeSection({
  metrics,
  isLoading,
}: {
  metrics: RouterOutputs["tinybird"]["metrics"] | undefined;
  isLoading: boolean;
}) {
  // Helper to transform the data the same way it used to be in the page
  function defineMetrics() {
    if (!metrics) return null;
    const _metrics = mapMetrics(metrics);

    if (_metrics.length !== 2) return null;

    // The pipes return two rows (current + previous window) via UNION ALL, whose
    // order ClickHouse doesn't guarantee. The current row carries a lastTimestamp,
    // the previous one is null — fold current last so its value + trend win.
    return _metrics
      .sort((a, b) => (a.lastTimestamp ? 1 : 0) - (b.lastTimestamp ? 1 : 0))
      .reduce(
        (acc, metric) => {
          Object.entries(metric).forEach(([key, value]) => {
            const k = key as keyof typeof acc;
            const v = (() => {
              if (k === "lastTimestamp") {
                if (!value) return "—";
                return formatDistanceToNowStrict(new Date(value ?? 0), {
                  addSuffix: true,
                });
              }
              if (k === "uptime") {
                return formatPercentage(value ?? 0, 3);
              }
              if (k.startsWith("p")) {
                return formatMilliseconds(value ?? 0);
              }
              return formatNumber(value ?? 0);
            })();

            if (k in acc) {
              // no prior-period baseline (raw === 0) → no trend, so we don't
              // render a misleading "0%" badge (e.g. the empty 90d previous window)
              const trend = acc[k]?.raw
                ? k === "uptime"
                  ? acc[k]?.raw / (value ?? 0)
                  : (value ?? 0) / acc[k]?.raw
                : Number.NaN;
              const hasTrend =
                !Number.isNaN(trend) &&
                trend !== Number.POSITIVE_INFINITY &&
                k !== "total" &&
                k !== "lastTimestamp";
              acc[k] = {
                label: metricsCards[k].label,
                status: metricsCards[k].status,
                value: v ?? "0",
                trend: hasTrend ? trend : null,
                raw: value ?? 0,
              } as (typeof acc)[typeof k & keyof typeof acc];
            } else {
              acc[k] = {
                label: metricsCards[k].label,
                status: metricsCards[k].status,
                value: v ?? "0",
                trend: 1,
                raw: value ?? 0,
              } as (typeof acc)[typeof k & keyof typeof acc];
            }
          });
          return acc;
        },
        {} as Record<
          keyof ReturnType<typeof mapMetrics>[number],
          Metric & { raw: number }
        >,
      );
  }

  const definedMetrics = defineMetrics();
  // a window with no checks (or a failed fetch) has no uptime or latency
  const noData = !metrics || !hasMetricsData(metrics);

  function refine(key: MetricKey): Metric & { active?: boolean } {
    const { label, status } = metricsCards[key];
    const isAlarm = key === "degraded" || key === "error";
    if (noData) {
      return {
        label,
        status,
        value: key === "total" ? "0" : "—",
        trend: null,
        active: isAlarm ? false : undefined,
      };
    }
    const metric = definedMetrics?.[key];
    return {
      label,
      status,
      value: metric?.value ?? "0",
      trend: metric?.trend ?? null,
      active: isAlarm ? (metric?.raw ?? 0) > 0 : undefined,
    };
  }

  return (
    <MetricStrip>
      {ROWS.map((row) => (
        <MetricStripRow key={row.label} label={row.label}>
          {row.keys.map((key) => {
            const metric = refine(key);
            const { value, unit } =
              row.label === "Latency"
                ? splitUnit(metric.value)
                : { value: metric.value, unit: null };
            return (
              <MetricStripItem
                key={key}
                status={metric.status}
                active={isLoading ? undefined : metric.active}
              >
                <MetricStripLabel>{metric.label}</MetricStripLabel>
                {isLoading ? (
                  <MetricStripSkeleton />
                ) : (
                  <MetricStripValue>
                    {value}
                    {unit ? <MetricStripUnit>{unit}</MetricStripUnit> : null}
                    {metric.trend ? (
                      <MetricStripBadge value={metric.trend} />
                    ) : null}
                  </MetricStripValue>
                )}
              </MetricStripItem>
            );
          })}
        </MetricStripRow>
      ))}
    </MetricStrip>
  );
}
