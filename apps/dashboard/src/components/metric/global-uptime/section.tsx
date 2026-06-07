"use client";

import {
  MetricCard,
  MetricCardBadge,
  MetricCardGroup,
  MetricCardHeader,
  MetricCardSkeleton,
  MetricCardTitle,
  MetricCardValue,
} from "@/components/metric/metric-card";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { type PERIODS, mapMetrics, metricsCards } from "@/data/metrics.client";
import {
  formatMilliseconds,
  formatNumber,
  formatPercentage,
} from "@/lib/formatter";
import { formatDistanceToNow } from "date-fns";

type Metric = {
  label: string;
  value: string;
  trend?: number | null;
  variant: React.ComponentProps<typeof MetricCard>["variant"];
};

// TODO: move the fetch to the parent component
// TODO: missing dynamic degraded

export function GlobalUptimeSection({
  monitorId,
  jobType,
  period = "7d",
  regions,
}: {
  monitorId: string;
  jobType: "http" | "tcp";
  period: (typeof PERIODS)[number];
  regions: string[] | undefined;
}) {
  const trpc = useTRPC();

  const { data: metrics, isLoading } = useQuery(
    trpc.tinybird.metrics.queryOptions({
      monitorId,
      period,
      type: jobType,
      regions,
    }),
  );

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
                if (!value) return "N/A";
                return formatDistanceToNow(new Date(value ?? 0), {
                  addSuffix: true,
                });
              }
              if (k === "uptime") {
                return formatPercentage(value ?? 0);
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
                variant: metricsCards[k].variant,
                value: v ?? "0",
                trend: hasTrend ? trend : null,
                raw: value ?? 0,
              } as (typeof acc)[typeof k & keyof typeof acc];
            } else {
              acc[k] = {
                label: metricsCards[k].label,
                variant: metricsCards[k].variant,
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

  const refinedMetrics: (Metric | null)[] = (
    [
      "uptime",
      "degraded",
      "error",
      "total",
      "lastTimestamp",
      "p50",
      "p75",
      "p90",
      "p95",
      "p99",
    ] as const
  ).map((key) => {
    if (!key) return null;
    const metric =
      defineMetrics()?.[key as keyof ReturnType<typeof mapMetrics>[number]];
    return {
      label: metricsCards[key].label,
      value: metric?.value ?? "0",
      trend: metric?.trend ?? null,
      variant: metricsCards[key].variant,
    } as Metric;
  });

  // TODO: rework, might be removed and simply add a condition on the other return
  if (isLoading) {
    return (
      <MetricCardGroup>
        {refinedMetrics.map((metric) => {
          if (metric === null)
            return <div key={metric} className="hidden lg:block" />;
          return (
            <MetricCard key={metric.label} variant={metric.variant}>
              <MetricCardHeader>
                <MetricCardTitle className="truncate">
                  {metric.label}
                </MetricCardTitle>
              </MetricCardHeader>
              <MetricCardSkeleton className="h-6 w-12" />
            </MetricCard>
          );
        })}
      </MetricCardGroup>
    );
  }

  return (
    <MetricCardGroup>
      {refinedMetrics.map((metric) => {
        if (metric === null)
          return <div key={metric} className="hidden lg:block" />;
        return (
          <MetricCard key={metric.label} variant={metric.variant}>
            <MetricCardHeader>
              <MetricCardTitle className="truncate">
                {metric.label}
              </MetricCardTitle>
            </MetricCardHeader>
            <div className="flex flex-row flex-wrap items-center gap-1.5">
              <MetricCardValue>{metric.value}</MetricCardValue>
              {metric.trend ? <MetricCardBadge value={metric.trend} /> : null}
            </div>
          </MetricCard>
        );
      })}
    </MetricCardGroup>
  );
}
